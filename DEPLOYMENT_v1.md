# Lumos AI English Coach v1.0: Sunucuya Dağıtım

Uygulama **Next.js 16 (App Router, TypeScript) standalone** olarak derlenir. Sunucuda yalnızca **Node.js** gerekir; Vercel veya başka bir platforma bağımlılık yoktur. Derlenen klasör kendi `node_modules` kopyasını içerir, sunucuda `npm install` çalıştırmana gerek yoktur.

## Mimari özeti

| Katman | Nerede | Not |
|---|---|---|
| Arayüz (React, Tailwind) | `src/components/`, `src/app/page.tsx` | Client component'ler. Dosya sistemine dokunmaz, veriyi `/api/*` üzerinden alır. |
| Dosya erişimi | `src/lib/server/` | `fs`, `path` ve Markdown ayrıştırma yalnızca burada. Her modül `server-only` ile korunur; istemci paketine girerse build hata verir. |
| API | `src/app/api/state/*`, `/api/chat`, `/api/feedback`, `/api/auth/*` | Hepsinde `runtime = 'nodejs'` ve `dynamic = 'force-dynamic'` tanımlı. |
| Kilit | `src/proxy.ts` (Next.js middleware) | `lumos_auth` çerezi olmadan sayfalar `/unlock`'a yönlenir, API çağrıları 401 alır. |
| Veriler | `data/` | `profile.json`, `vocabulary.md`, `error_ledger.md`, `sessions/`, `CLAUDE.md`. Şemalar değişmedi. |

## 1. Yerelde derle

```powershell
cd C:\Users\halil\english-coach\app
npm ci
npm run build
```

`npm run build` iki adım çalıştırır:
1. `next build` derler ve `.next/standalone` klasörünü oluşturur.
2. `scripts/assemble-standalone.mjs`, Next.js'in standalone'a kendiliğinden koymadığı parçaları içine kopyalar.

Sonuçta **`app/.next/standalone/`** tek başına çalışabilen sunucu klasörüdür:

```
.next/standalone/
├── server.js              # Next.js sunucusu (node server.js)
├── .next/                 # derlenmiş sunucu kodu
│   └── static/            # ← .next/static buraya kopyalandı (JS/CSS)
├── public/                # ← public/ buraya kopyalandı (robots.txt)
├── node_modules/          # yalnızca çalışma zamanı paketleri
├── data/                  # ← koç dosyalarının ilk kopyası (yalnızca yoksa oluşturulur)
├── package.json
├── ecosystem.config.cjs   # PM2 ayarı
└── .env.example           # ayar şablonu
```

## 2. Sunucuya kopyalanacaklar

`.next/standalone/` klasörünün **içindekileri** sunucuda web kökünün dışındaki bir klasöre yükle, örneğin `/var/www/lumos` ya da `/home/KULLANICI/lumos`.

Elle birleştirmek istersen dört parça şöyle eşleşir:

| Yereldeki kaynak | Sunucudaki hedef |
|---|---|
| `app/.next/standalone/*` | `/var/www/lumos/` |
| `app/.next/static/` | `/var/www/lumos/.next/static/` |
| `app/public/` | `/var/www/lumos/public/` |
| `english-coach/` kökündeki `profile.json`, `vocabulary.md`, `error_ledger.md`, `CLAUDE.md`, `sessions/` | `/var/www/lumos/data/` |

> Gizli dosyalar (`.next`, `.env.example`) FTP istemcisinde gizli olabilir; "gizli dosyaları göster" seçeneğini aç.

## 3. `.env` dosyası

`server.js` ile aynı klasörde `.env` oluştur (`.env.example`'ı kopyala) ve `chmod 600 .env` ile koru:

```dotenv
# Zorunlu: kilit ekranının istediği ana PIN / şifre (en az 8 karakter)
APP_SECRET_PIN=buraya-guclu-bir-pin

# Önerilir: lumos_auth çerezini imzalayan uzun rastgele anahtar
# Üret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
APP_SESSION_SECRET=

# İsteğe bağlı: Coach sohbeti ve Claude geri bildirimi (yoksa çevrimdışı geri bildirim çalışır)
ANTHROPIC_API_KEY=
COACH_MODEL=claude-opus-5-5

# Node sunucusunun portu (Nginx buraya yönlendirir)
PORT=3001

# Veri klasörü (server.js'e göre)
COACH_DATA_DIR=./data
```

- **APP_SECRET_PIN** yoksa üretim sunucusu tüm isteklere 503 döner ve açık kalmaz.
- **COACH_MODEL:** Varsayılan `claude-opus-5-5`. İstekte geçen `claude-3-5-sonnet-20241022`, Anthropic tarafından kullanımdan kaldırıldı ve artık yanıt vermiyor. Bu yüzden onu varsayılan yapmadım; model değiştirmek için bu değişkeni kullan.
- `PORT` ve `HOSTNAME` değerlerini PM2 dosyası da verir. İkisi birden tanımlıysa PM2'deki değer geçerli olur.

## 4. PM2 ile başlat

```bash
cd /var/www/lumos
npm install -g pm2                 # bir kez
pm2 start ecosystem.config.cjs     # süreç adı: lumos-coach (PORT 3001, HOSTNAME 127.0.0.1)
pm2 save
pm2 startup                        # yeniden açılışta otomatik başlat (çıkan komutu çalıştır)
```

Ecosystem dosyası olmadan tek satır:

```bash
cd /var/www/lumos
NODE_ENV=production PORT=3001 HOSTNAME=127.0.0.1 pm2 start server.js --name lumos-coach
```

> **HOSTNAME önemli:** Next.js standalone sunucusu `HOSTNAME` değişkenine bağlanır. Bazı sunucularda bu değişken makine adıyla dolu gelir. `127.0.0.1` (Nginx arkasında) ya da `0.0.0.0` olarak açıkça ver.
>
> **Tek süreç:** `instances: 1` olarak bırak. Dosya yazımları süreç içi bir kuyruktan geçer; cluster modu veri bozabilir.

Kontrol:

```bash
pm2 logs lumos-coach               # "Ready" satırını görmelisin
curl -s http://127.0.0.1:3001/api/auth/status   # {"required":true,"authenticated":false}
```

## 5. Nginx reverse proxy ve SSL

Uygulama alan adının köküne göre derlenir. Bir alt alan adı kullan, örneğin **`coach.ozgurdeveci.com`**. `www.ozgurdeveci.com` ana siten olarak kalır.

`/etc/nginx/sites-available/lumos`:

```nginx
server {
    listen 80;
    server_name coach.ozgurdeveci.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name coach.ozgurdeveci.com;

    ssl_certificate     /etc/letsencrypt/live/coach.ozgurdeveci.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/coach.ozgurdeveci.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;

    client_max_body_size 2m;

    # Derlenmiş JS/CSS: içerik özetli dosya adları, uzun süre önbelleklenebilir
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;          # PIN deneme sınırı bu adresi kullanır
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;       # çerez HTTPS'te "Secure" olur
        proxy_buffering off;                              # Coach yanıtları akarak gelsin (SSE)
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lumos /etc/nginx/sites-enabled/
sudo certbot --nginx -d coach.ozgurdeveci.com     # Let's Encrypt sertifikası
sudo nginx -t && sudo systemctl reload nginx
```

Panel tabanlı hostingde (cPanel/Plesk) Node.js uygulaması olarak **Application startup file: `server.js`** seç. Ortam değişkenlerini panelden gir ve SSL'i AutoSSL ile aç.

## 6. Güvenlik

- **PIN kontrolü:** PIN sunucuda `/api/auth/verify` ile `APP_SECRET_PIN`'e karşı sabit sürede karşılaştırılır.
- **Oturum çerezi:** Başarılı girişte `lumos_auth` çerezi oluşur: HMAC-SHA256 imzalı, `HttpOnly`, `SameSite=Strict`, HTTPS'te `Secure`, 30 gün geçerli.
- **Kilit:** `src/proxy.ts` her sayfa ve API isteğinde çerezi doğrular. Yalnızca `/unlock` ve `/api/auth/*` açıktır.
- **Deneme sınırı:** Aynı adresten 5 yanlış PIN o adresi 15 dakika kilitler. Tüm adreslerden toplam 30 yanlış deneme, sahte IP ile yapılan denemelere karşı herkesi 15 dakika kilitler.
- **Çıkış:** `APP_SECRET_PIN` veya `APP_SESSION_SECRET` değişince açık oturumların hepsi kapanır.
- **Başlıklar:** Sayfalar `noindex` ve `X-Frame-Options: DENY` ile sunulur.

## 7. Güncelleme

1. Yerelde `git pull` ve `npm run build` çalıştır.
2. `.next/standalone/` içeriğini sunucuya yükle, ama **`data/` ve `.env` dosyalarını atla**. Bunlar sunucudaki ilerlemendir.
3. `pm2 restart lumos-coach`

## 8. Yedekleme

```bash
tar -czf ~/lumos-backup-$(date +%F).tar.gz -C /var/www/lumos data
```

Günlük yedek için: `crontab -e` → `15 3 * * * tar -czf ~/lumos-backup-$(date +\%F).tar.gz -C /var/www/lumos data`

## 9. Sorun giderme

| Belirti | Çözüm |
|---|---|
| Her sayfa "APP_SECRET_PIN is not set" diyor | `.env` dosyasını `server.js` ile aynı klasöre koy, `pm2 restart lumos-coach`. |
| `502 Bad Gateway` | `pm2 logs lumos-coach`: süreç çalışıyor mu, `PORT` Nginx'tekiyle aynı mı? |
| Sunucu yalnızca makine adında dinliyor | `HOSTNAME=127.0.0.1` ver (ecosystem dosyasında hazır). |
| Stil/JS yüklenmiyor (404 `/_next/static`) | `.next/static` klasörü `server.js`'in yanındaki `.next/` içine kopyalanmamış. |
| Coach yanıtı bir anda geliyor | Nginx'te `proxy_buffering off;` eksik. |
| Veriler kaydedilmiyor | Node sürecinin kullanıcısı `data/` klasörüne yazabilmeli: `chown -R KULLANICI data`. |
| "Offline feedback" yazıyor | `ANTHROPIC_API_KEY` boş; ekle ve yeniden başlat. |
