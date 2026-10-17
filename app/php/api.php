<?php
// Lumos AI English Coach v1.0: the whole server side, for shared hosting (PHP 7.4+ with cURL).
//
//   GET  ?action=auth_status            lock state, AI availability
//   POST ?action=verify    {pin}        checks APP_SECRET_PIN, sets the signed lumos_auth cookie
//   POST ?action=logout
//   GET  ?action=get_state              profile.json, vocabulary.md, error_ledger.md, session list
//   POST ?action=save_state {version, files}   writes changed files (whitelisted names only)
//   GET  ?action=get_session&date=YYYY-MM-DD
//   POST ?action=feedback  {prompt, schema}     Gemini JSON answer (Triple-Layer feedback)
//   POST ?action=chat      {messages, context}  Gemini reply, streamed as Server-Sent Events
//
// The coaching logic (SM-2, sub-bands, error ledger, session summaries) runs in the browser;
// this file only guards, stores and relays. Every action except auth_status/verify needs the cookie.

declare(strict_types=1);

define('LUMOS', true);
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

const STATE_FILES = ['profile.json', 'vocabulary.md', 'error_ledger.md'];
const DATE_RE = '/^\d{4}-\d{2}-\d{2}$/';
const MAX_FILE_BYTES = 1048576;
const COOKIE = 'lumos_auth';

// ---------- helpers ----------

function out(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status, array $extra = []): void
{
    out(['error' => $message] + $extra, $status);
}

function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 4 * MAX_FILE_BYTES);
    $data = json_decode((string) $raw, true);
    if (!is_array($data)) {
        fail('Request body must be JSON', 400);
    }
    return $data;
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function b64url(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

// ---------- auth: signed cookie "<expiry>.<HMAC-SHA256>" ----------

function sign(string $value): string
{
    return b64url(hash_hmac('sha256', $value, APP_SESSION_SECRET . ':lumos:' . APP_SECRET_PIN, true));
}

function set_auth_cookie(string $value, int $expires): void
{
    setcookie(COOKIE, $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function is_authenticated(): bool
{
    $parts = explode('.', (string) ($_COOKIE[COOKIE] ?? ''));
    if (count($parts) !== 2 || !ctype_digit($parts[0]) || (int) $parts[0] <= time()) {
        return false;
    }
    return hash_equals(sign($parts[0]), $parts[1]);
}

/**
 * Brute-force brake, kept in data/.auth-attempts.json: MAX_FAILS wrong PINs from one address lock it
 * for LOCK_MINUTES; GLOBAL_MAX_FAILS from all addresses together lock everyone. Uses REMOTE_ADDR,
 * which a client cannot fake with headers. $change receives the state and may modify it.
 */
function with_attempts(callable $change)
{
    $fh = fopen(DATA_DIR . '/.auth-attempts.json', 'c+');
    if (!$fh) {
        return null;
    }
    flock($fh, LOCK_EX);
    $state = json_decode((string) stream_get_contents($fh), true) ?: ['ips' => [], 'global' => []];
    $now = time();
    $window = LOCK_MINUTES * 60;
    $state['global'] = array_values(array_filter($state['global'], function ($t) use ($now, $window) {
        return $t > $now - $window;
    }));
    $state['ips'] = array_filter($state['ips'], function ($e) use ($now, $window) {
        return $e['until'] > $now || $e['last'] > $now - $window;
    });
    $result = $change($state, $now, $window, $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($state));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

/** Seconds until this address may try again, or null if it may try now. */
function lockout_wait(): ?int
{
    return with_attempts(function (array &$s, int $now, int $window, string $ip) {
        if (($s['ips'][$ip]['until'] ?? 0) > $now) {
            return $s['ips'][$ip]['until'] - $now;
        }
        return count($s['global']) >= GLOBAL_MAX_FAILS ? $s['global'][0] + $window - $now : null;
    });
}

/** Records a wrong PIN; returns the lockout in seconds if this attempt triggered one. */
function record_failure(): ?int
{
    return with_attempts(function (array &$s, int $now, int $window, string $ip) {
        $e = $s['ips'][$ip] ?? ['fails' => 0, 'until' => 0, 'last' => 0];
        $e['fails']++;
        $e['last'] = $now;
        $s['global'][] = $now;
        $wait = null;
        if ($e['fails'] >= MAX_FAILS) {
            $e = ['fails' => 0, 'until' => $now + $window, 'last' => $now];
            $wait = $window;
        } elseif (count($s['global']) >= GLOBAL_MAX_FAILS) {
            $wait = $window;
        }
        $s['ips'][$ip] = $e;
        return $wait;
    });
}

function clear_failures(): void
{
    with_attempts(function (array &$s, int $now, int $window, string $ip) {
        unset($s['ips'][$ip]);
    });
}

function locked_message(int $wait): string
{
    return 'Too many attempts. Try again in ' . max(1, (int) ceil($wait / 60)) . ' min.';
}

// ---------- data folder ----------

/** Makes sure data/ exists and is protected. The release ships data/ with the starting files; data-seed/ is an optional fallback. */
function ensure_data_dir(): void
{
    if (!is_dir(DATA_DIR . '/sessions') && !@mkdir(DATA_DIR . '/sessions', 0755, true) && !is_dir(DATA_DIR . '/sessions')) {
        fail('Cannot create the data folder. Give the web server write access to ' . basename(DATA_DIR) . '/.', 500);
    }
    if (!file_exists(DATA_DIR . '/.htaccess')) {
        @file_put_contents(DATA_DIR . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
        @file_put_contents(DATA_DIR . '/index.html', '');
    }
    if (!file_exists(DATA_DIR . '/profile.json') && is_dir(SEED_DIR)) {
        foreach (STATE_FILES as $name) {
            if (is_file(SEED_DIR . "/$name")) {
                copy(SEED_DIR . "/$name", DATA_DIR . "/$name");
            }
        }
        foreach (glob(SEED_DIR . '/sessions/*.md') ?: [] as $f) {
            copy($f, DATA_DIR . '/sessions/' . basename($f));
        }
    }
    if (!file_exists(DATA_DIR . '/profile.json')) {
        fail('profile.json is missing in the data folder and there is no data-seed/ to start from.', 500);
    }
}

function current_version(): int
{
    return (int) @file_get_contents(DATA_DIR . '/.version');
}

function write_atomic(string $path, string $content): void
{
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $content, LOCK_EX) === false || !rename($tmp, $path)) {
        @unlink($tmp);
        fail('Could not write ' . basename($path) . '. Check folder permissions.', 500);
    }
}

/** Once a day, before the first save, keep a copy of the files (the last 14 days are kept). */
function daily_backup(): void
{
    $dir = DATA_DIR . '/backups/' . date('Y-m-d');
    if (is_dir($dir)) {
        return;
    }
    @mkdir($dir, 0755, true);
    foreach (STATE_FILES as $name) {
        if (is_file(DATA_DIR . "/$name")) {
            @copy(DATA_DIR . "/$name", "$dir/$name");
        }
    }
    $all = glob(DATA_DIR . '/backups/*', GLOB_ONLYDIR) ?: [];
    sort($all);
    foreach (array_slice($all, 0, max(0, count($all) - 14)) as $old) {
        array_map('unlink', glob("$old/*") ?: []);
        @rmdir($old);
    }
}

function session_names(): array
{
    $names = array_map('basename', glob(DATA_DIR . '/sessions/*.md') ?: []);
    return array_values(array_filter($names, function ($n) {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}\.md$/', $n);
    }));
}

// ---------- Gemini ----------

function coach_rules(): string
{
    if (!is_readable(COACH_RULES_FILE)) {
        $rules = '';
    } elseif (substr(COACH_RULES_FILE, -4) === '.php') {
        $rules = (string) include COACH_RULES_FILE;
    } else {
        $rules = (string) file_get_contents(COACH_RULES_FILE);
    }
    return $rules !== '' ? $rules : 'You are Lumos AI English Coach, an elite English coach and CEFR assessor.';
}

function gemini_url(string $method, bool $sse = false): string
{
    return GEMINI_BASE_URL . '/models/' . rawurlencode(GEMINI_MODEL) . ':' . $method . ($sse ? '?alt=sse' : '');
}

function gemini_curl(string $url, array $payload)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . GEMINI_API_KEY],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 120,
    ]);
    return $ch;
}

function gemini_error(int $status, string $body): string
{
    $msg = json_decode($body, true)['error']['message'] ?? '';
    if (($status === 400 && stripos($msg, 'API key') !== false) || $status === 403) {
        return 'Gemini rejected the API key';
    }
    if ($status === 404) {
        return 'Gemini model "' . GEMINI_MODEL . '" was not found. Set GEMINI_MODEL in .env';
    }
    if ($status === 429) {
        return 'Gemini rate limit reached. Try again in a minute';
    }
    return 'Gemini error (' . ($status ?: 'no connection') . ')' . ($msg ? ': ' . $msg : '');
}

function candidate_text(array $data): string
{
    $text = '';
    foreach ($data['candidates'][0]['content']['parts'] ?? [] as $part) {
        $text .= $part['text'] ?? '';
    }
    return $text;
}

/** Turns the app's chat history into Gemini contents: roles user/model, starting with the learner. */
function chat_contents(array $messages): array
{
    $contents = [];
    foreach (array_slice($messages, -24) as $m) {
        $role = $m['role'] ?? '';
        $text = is_string($m['content'] ?? null) ? trim($m['content']) : '';
        if ($text === '' || !in_array($role, ['user', 'assistant'], true)) {
            continue;
        }
        $contents[] = ['role' => $role === 'user' ? 'user' : 'model', 'parts' => [['text' => mb_substr($text, 0, 6000)]]];
    }
    while ($contents && $contents[0]['role'] !== 'user') {
        array_shift($contents);
    }
    return $contents;
}

// ---------- routing ----------

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (APP_SECRET_PIN === '') {
    fail('APP_SECRET_PIN is not set. Create the .env file next to api.php (see .env.example).', 503);
}
// Cross-site requests cannot send this header without a CORS preflight, which this API never allows.
if ($method === 'POST' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'lumos') {
    fail('Forbidden', 403);
}

ensure_data_dir();

if ($action === 'auth_status') {
    out(['required' => true, 'authenticated' => is_authenticated(), 'ai' => GEMINI_API_KEY !== '', 'model' => GEMINI_MODEL, 'version' => LUMOS_VERSION]);
}

if ($action === 'verify' && $method === 'POST') {
    $wait = lockout_wait();
    if ($wait !== null) {
        header('Retry-After: ' . $wait);
        fail(locked_message($wait), 429);
    }
    $pin = body()['pin'] ?? '';
    if (!is_string($pin) || $pin === '' || !hash_equals(APP_SECRET_PIN, $pin)) {
        $wait = record_failure();
        fail($wait !== null ? locked_message($wait) : 'Wrong PIN.', $wait !== null ? 429 : 401);
    }
    clear_failures();
    $expires = time() + SESSION_DAYS * 86400;
    set_auth_cookie($expires . '.' . sign((string) $expires), $expires);
    out(['authenticated' => true]);
}

if ($action === 'logout' && $method === 'POST') {
    set_auth_cookie('', time() - 3600);
    out(['authenticated' => false]);
}

if (!is_authenticated()) {
    fail('Locked', 401, ['locked' => true]);
}

switch ($action) {
    case 'get_state':
        $files = [];
        foreach (STATE_FILES as $name) {
            $files[$name] = is_file(DATA_DIR . "/$name") ? (string) file_get_contents(DATA_DIR . "/$name") : '';
        }
        out(['version' => current_version(), 'files' => $files, 'sessions' => session_names()]);

    case 'get_session':
        $date = (string) ($_GET['date'] ?? '');
        if (!preg_match(DATE_RE, $date)) {
            fail('Invalid date', 400);
        }
        $path = DATA_DIR . "/sessions/$date.md";
        if (!is_file($path)) {
            fail('Session not found', 404);
        }
        out(['date' => $date, 'content' => (string) file_get_contents($path)]);

    case 'save_state':
        if ($method !== 'POST') {
            fail('Use POST', 405);
        }
        $req = body();
        $files = $req['files'] ?? null;
        if (!is_array($files) || !$files) {
            fail('files must be an object of file name => content', 400);
        }
        foreach ($files as $name => $content) {
            $name = (string) $name;
            if (!in_array($name, STATE_FILES, true) && !preg_match('#^sessions/\d{4}-\d{2}-\d{2}\.md$#', $name)) {
                fail("Not allowed to write \"$name\"", 400);
            }
            if (!is_string($content) || strlen($content) > MAX_FILE_BYTES) {
                fail("\"$name\" must be text under 1 MB", 400);
            }
            if ($name === 'profile.json' && !is_array(json_decode($content, true))) {
                fail('profile.json must be a JSON object', 400);
            }
        }
        $lock = fopen(DATA_DIR . '/.lock', 'c');
        flock($lock, LOCK_EX);
        $version = current_version();
        if ((int) ($req['version'] ?? -1) !== $version) {
            flock($lock, LOCK_UN);
            fail('The files were changed from another device. Reload and try again.', 409, ['version' => $version]);
        }
        daily_backup();
        foreach ($files as $name => $content) {
            write_atomic(DATA_DIR . '/' . $name, $content);
        }
        write_atomic(DATA_DIR . '/.version', (string) ($version + 1));
        flock($lock, LOCK_UN);
        out(['version' => $version + 1, 'saved' => array_keys($files)]);

    case 'feedback':
        if ($method !== 'POST') {
            fail('Use POST', 405);
        }
        if (GEMINI_API_KEY === '') {
            fail('GEMINI_API_KEY is not set', 503);
        }
        $req = body();
        $prompt = is_string($req['prompt'] ?? null) ? mb_substr($req['prompt'], 0, 20000) : '';
        if ($prompt === '') {
            fail('prompt is required', 400);
        }
        $payload = [
            'systemInstruction' => ['parts' => [['text' => coach_rules()]]],
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => 0.4, 'maxOutputTokens' => 8192],
        ];
        if (is_array($req['schema'] ?? null)) {
            $payload['generationConfig']['responseSchema'] = $req['schema'];
        }
        for ($try = 0; $try < 2; $try++) {
            $ch = gemini_curl(gemini_url('generateContent'), $payload);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $res = (string) curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
            // A schema the model version does not accept: ask again with JSON mode only.
            if ($status === 400 && isset($payload['generationConfig']['responseSchema']) && stripos($res, 'API key') === false) {
                unset($payload['generationConfig']['responseSchema']);
                continue;
            }
            break;
        }
        if ($status !== 200) {
            fail(gemini_error($status, $res), 502);
        }
        $data = json_decode($res, true) ?: [];
        $text = candidate_text($data);
        if ($text === '') {
            fail('Gemini returned no answer (' . ($data['candidates'][0]['finishReason'] ?? $data['promptFeedback']['blockReason'] ?? 'empty') . ')', 502);
        }
        out(['text' => $text, 'model' => $data['modelVersion'] ?? GEMINI_MODEL]);

    case 'chat':
        if ($method !== 'POST') {
            fail('Use POST', 405);
        }
        if (GEMINI_API_KEY === '') {
            fail('The AI coach is offline: set GEMINI_API_KEY in .env on the server.', 503);
        }
        $req = body();
        $contents = chat_contents(is_array($req['messages'] ?? null) ? $req['messages'] : []);
        if (!$contents || end($contents)['role'] !== 'user') {
            fail('messages must end with a user message', 400);
        }
        $context = is_string($req['context'] ?? null) ? mb_substr($req['context'], 0, 8000) : '';
        $system = coach_rules() . "\n\n---\n## Current learner state (from the files on the server)\n```json\n$context\n```\n"
            . 'This is a chat in the Lumos web app. The app saves tasks, warm-up reviews and scores to the files itself; '
            . "in this chat, coach and practise. Answer in English at the learner's level; add short Turkish help only when it unblocks them.";

        // Stream: relay Gemini's SSE as {"text": "..."} events, flushing every chunk.
        @set_time_limit(180);
        @ini_set('zlib.output_compression', '0');
        @ini_set('output_buffering', '0');
        while (ob_get_level() > 0) {
            ob_end_flush();
        }
        header('Content-Type: text/event-stream; charset=utf-8');
        header('X-Accel-Buffering: no');
        $send = function (array $data): void {
            echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
            flush();
        };
        $buffer = '';
        $raw = '';
        $ch = gemini_curl(gemini_url('streamGenerateContent', true), [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => $contents,
            'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 4096],
        ]);
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, string $chunk) use (&$buffer, &$raw, $send): int {
            if (connection_aborted()) {
                return 0; // the learner left: stop the upstream request
            }
            $raw .= strlen($raw) < 65536 ? $chunk : '';
            $buffer .= str_replace("\r\n", "\n", $chunk);
            while (($pos = strpos($buffer, "\n\n")) !== false) {
                $event = substr($buffer, 0, $pos);
                $buffer = substr($buffer, $pos + 2);
                foreach (explode("\n", $event) as $line) {
                    if (strncmp($line, 'data: ', 6) === 0) {
                        $text = candidate_text(json_decode(substr($line, 6), true) ?: []);
                        if ($text !== '') {
                            $send(['text' => $text]);
                        }
                    }
                }
            }
            return strlen($chunk);
        });
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if (connection_aborted()) {
            exit;
        }
        $send($status === 200 ? ['done' => true] : ['error' => gemini_error($status, $raw) . '.']);
        exit;

    default:
        fail('Unknown action', 404);
}
