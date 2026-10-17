<?php
// Seyyahname AI English Coach v1.0: settings for api.php.
// Values come from a .env file next to this file, or one folder above it (outside the web root,
// the safer place). Real environment variables set by the host win over .env.

if (!defined('LUMOS')) {
    http_response_code(403);
    exit;
}

function lumos_load_env(): void
{
    foreach ([__DIR__ . '/.env', dirname(__DIR__) . '/.env'] as $file) {
        if (!is_readable($file)) {
            continue;
        }
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                continue;
            }
            [$key, $value] = array_map('trim', explode('=', $line, 2));
            if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && substr($value, -1) === $value[0]) {
                $value = substr($value, 1, -1);
            }
            if (getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
        return;
    }
}

function lumos_env(string $key, string $default = ''): string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $default : $value;
}

lumos_load_env();

// Some hosts ship PHP without mbstring; plain substr is close enough for length limits.
if (!function_exists('mb_substr')) {
    function mb_substr(string $s, int $start, ?int $length = null): string
    {
        return (string) substr($s, $start, $length ?? strlen($s));
    }
}

define('LUMOS_VERSION', '1.0.0');

// Required: the master PIN the lock screen asks for.
define('APP_SECRET_PIN', lumos_env('APP_SECRET_PIN'));
// Recommended: mixed into the login cookie signature. Changing it (or the PIN) signs everyone out.
define('APP_SESSION_SECRET', lumos_env('APP_SESSION_SECRET'));

// AI: Google Gemini. Without a key the app uses its offline feedback engine.
define('GEMINI_API_KEY', lumos_env('GEMINI_API_KEY'));
define('GEMINI_MODEL', lumos_env('GEMINI_MODEL', 'gemini-flash-latest'));
define('GEMINI_BASE_URL', rtrim(lumos_env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'), '/'));

// Where profile.json, vocabulary.md, error_ledger.md and sessions/ are kept: a path relative to this
// folder, or absolute. On first run it is filled from data-seed/.
$dataDir = lumos_env('DATA_DIR', 'data');
define('DATA_DIR', rtrim(preg_match('~^(/|[A-Za-z]:[\\\\/])~', $dataDir) ? $dataDir : __DIR__ . '/' . $dataDir, '/\\'));
define('SEED_DIR', __DIR__ . '/data-seed');

// The coaching rules, sent to Gemini as the system instruction: rules.php (CLAUDE.md compiled in at
// build time, so no .md file has to sit in the web root), or CLAUDE.md next to this file as a fallback.
define('COACH_RULES_FILE', is_file(__DIR__ . '/rules.php') ? __DIR__ . '/rules.php' : __DIR__ . '/CLAUDE.md');

// The Master English Curriculum (A1.1-C2.2): injected into Gemini's system instruction for the active band.
define('CURRICULUM_FILE', __DIR__ . '/curriculum.json');

define('SESSION_DAYS', 30);
define('MAX_FAILS', 5);          // wrong PINs from one address before it is locked
define('GLOBAL_MAX_FAILS', 30);  // wrong PINs from all addresses together before everyone is locked
define('LOCK_MINUTES', 15);
