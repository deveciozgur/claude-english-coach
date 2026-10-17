# Apex AI English Coach: Sunucuya Kurulum Rehberi

Bu rehber, uygulamayı **ozgurdeveci.com** sunucuna FTP/SSH ya da dosya yöneticisiyle elle yüklemeni anlatır. Vercel gibi harici bir platforma gerek yok. Sunucuda yalnızca **Node.js** çalışması yeterli.

## Mimari (kısaca)

| Parça | Ne yapar |
|---|---|
| `dist/` | Derlenmiş arayüz (statik HTML/JS/CSS). Node sunucusu bunu kendisi sunar. |
| `server/` | Express API: PIN kilidi, `/api/state`, `/api/chat` (Claude streaming), görevler ve SM-2. |
| `data/` | Kalıcı veriler: `profile.json`, `vocabulary.md`, `error_ledger.md`, `sessions/`, `CLAUDE.md`. Uygulama bunları doğrudan sunucu diskine yazar. |
| `.env` | Gizli ayarlar: PIN, oturum anahtarı, Anthropic API anahtarı. |

Tek bir Node süreci hem arayüzü hem API'yi aynı adreste sunar. Ayrı bir web sunucusu kurulumu gerekmez, ama önüne Nginx/Apache (HTTPS için) koyman önerilir.

---

## 1. Gereksinimler

- Sunucuda **Node.js 20.12 veya üstü** (22 LTS önerilir). Kontrol: `node -v`
- Ya **SSH erişimi** (PM2 ile çalıştırma, önerilen) ya da hosting panelinde **"Setup Node.js App"** (cPanel/Plesk) özelliği
- Claude sohbeti için bir **Anthropic API anahtarı** (isteğe bağlı; yoksa uygulama çevrimdışı geri bildirimle çalışır)

## 2. Yerelde paketi derle (tek komut)

Kendi bilgisayarında (PowerShell):

```powershell
cd C:\Users\halil\english-coach\app
npm ci
npm run build
```

`npm run build` arayüzü derler ve sunucuya yüklenecek her şeyi **`app/release/`** klasörüne toplar:

```
release/
├── dist/                  # derlenmiş arayüz
├── server/                # Node API
├── shared/                # CEFR verisi (sunucu ve arayüz ortak)
├── data/                  # profile.json, vocabulary.md, error_ledger.md, sessions/, CLAUDE.md
├── package.json
├── package-lock.json
├── ecosystem.config.cjs   # PM2 ayarı
├── app.cjs                # cPanel/Passenger için başlangıç dosyası
└── .env.example           # ayar şablonu
```

## 3. Sunucuya yükle

`release/` klasörünün **içindekileri** sunucuda web kökünün dışındaki bir klasöre yükle. Örneğin:

```
/home/KULLANICI/apex-coach/
```

> `public_html` içine koyma. Node kendi portundan sunar; `data/` ve `.env` dışarıdan indirilebilir olmamalı.

- `node_modules/` klasörünü **yükleme**. Bağımlılıkları sunucuda kuracaksın (adım 4).
- FTP ile yüklüyorsan dosyaları ikili (binary) modda aktar.

## 4. Bağımlılıkları kur ve `.env` dosyasını hazırla

SSH ile:

```bash
cd ~/apex-coach
npm ci --omit=dev          # yalnızca sunucu paketleri (express, @anthropic-ai/sdk)
cp .env.example .env
nano .env                  # değerleri doldur
chmod 600 .env
```

`.env` içinde doldurman gerekenler:

| Değişken | Zorunlu mu | Açıklama |
|---|---|---|
| `APP_SECRET_PIN` | **Evet** | Kilit ekranının istediği şifre. En az 8 karakter seç. Boş bırakılırsa sunucu açılmaz. |
| `APP_SESSION_SECRET` | Önerilir | Giriş çerezini imzalar. Boşsa her yeniden başlatmada yeniden giriş istenir. Üret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | İsteğe bağlı | Claude sohbetini (Coach sekmesi) ve Claude geri bildirimini açar. |
| `COACH_MODEL` | İsteğe bağlı | Claude model kimliği, varsayılan `claude-opus-5-5`. |
| `PORT` | İsteğe bağlı | Varsayılan `3001`. |
| `HOST` | İsteğe bağlı | Önünde Nginx/Apache varsa `127.0.0.1`; doğrudan erişim için `0.0.0.0`. |
| `COACH_DATA_DIR` | İsteğe bağlı | Veri klasörü, varsayılan `./data`. |

> Not: Claude 3.5 Sonnet, Anthropic tarafından kullanımdan kaldırıldı. Bu yüzden varsayılan model güncel bir Claude modeli. Başka bir model istersen `COACH_MODEL` değerini değiştirmen yeterli.

## 5. PM2 ile başlat (SSH, önerilen)

```bash
npm install -g pm2
cd ~/apex-coach
pm2 start ecosystem.config.cjs   # süreç adı: apex-coach
pm2 save                         # süreç listesini kaydet
pm2 startup                      # sunucu yeniden açılınca otomatik başlat (çıkan komutu çalıştır)
```

Kontrol:

```bash
pm2 status
pm2 logs apex-coach              # "English Coach API on http://localhost:3001" görmelisin
curl http://127.0.0.1:3001/api/auth/status   # {"required":true,"authenticated":false}
```

> PM2'yi **tek süreç** (`instances: 1`) ile çalıştır. Dosya yazımları tek bir süreç içi kuyruktan geçer; cluster modu verileri bozabilir.

## 6. Alan adına bağla (HTTPS)

Uygulama kök yoldan (`/`) çalışacak şekilde derlenir. Bu yüzden onu bir **alt alan adına** bağlaman en temizi, örneğin `coach.ozgurdeveci.com`. Ana siten `www.ozgurdeveci.com` olduğu gibi kalır.

### Nginx

```nginx
server {
    server_name coach.ozgurdeveci.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;          # Claude yanıtlarının akarak gelmesi (SSE) için
        proxy_read_timeout 300s;
    }
}
```

Sonra HTTPS: `sudo certbot --nginx -d coach.ozgurdeveci.com`

### Apache (VirtualHost yapılandırması, `mod_proxy` ve `mod_headers` açık olmalı)

```apache
ProxyPreserveHost On
ProxyPass        / http://127.0.0.1:3001/ flushpackets=on
ProxyPassReverse / http://127.0.0.1:3001/
RequestHeader set X-Forwarded-Proto "https"
```

HTTPS sertifikasını panelden (AutoSSL / Let's Encrypt) aç. Giriş çerezi HTTPS üzerinden otomatik olarak `Secure` işaretlenir.

## 7. Alternatif: cPanel "Setup Node.js App" (SSH yoksa)

1. **Create Application**: Node.js 20 veya üstü, **Application mode:** Production.
2. **Application root:** `apex-coach` (dosyaları yüklediğin klasör).
3. **Application URL:** `coach.ozgurdeveci.com` (veya seçtiğin alan adı).
4. **Application startup file:** `app.cjs`
5. **Environment variables:** `APP_SECRET_PIN`, `APP_SESSION_SECRET`, `ANTHROPIC_API_KEY` değerlerini buraya ekle (ya da `.env` dosyasını yükle). `PORT` ekleme; panel kendisi verir.
6. **Run NPM Install**'a, ardından **Restart**'a bas.

## 8. İlk giriş

1. `https://coach.ozgurdeveci.com` adresini aç.
2. Kilit ekranında `APP_SECRET_PIN` değerini gir. Oturum 30 gün açık kalır; sağ üstteki kilit simgesiyle kapatabilirsin.
3. Üst menü: **Studio** (4 beceri modu ve ısınma), **Coach** (Claude sohbeti), **Vault** (kelimeler, polish listesi, Can-Do panosu), **Archive** (oturum kayıtları).

Güvenlik notları:
- PIN sunucuda kontrol edilir. Doğru PIN, imzalı ve `HttpOnly` bir çerez oluşturur. Tarayıcıda PIN saklanmaz.
- Aynı IP'den 5 hatalı denemeden sonra giriş 15 dakika kilitlenir.
- Kilit açılmadan hiçbir `/api` çağrısı yanıt vermez (yalnızca `/api/auth/*` açık).
- Sayfa arama motorlarına kapalıdır (`noindex`).

## 9. Güncelleme

1. Yerelde: `git pull`, ardından `cd app` ve `npm run build`.
2. Sunucuya `release/` içeriğini yükle, **ama `data/` klasörünü ve `.env` dosyasını atla**. Bunlar sunucudaki ilerlemendir; üzerine yazarsan kaybolur.
3. Sunucuda:
   ```bash
   cd ~/apex-coach
   npm ci --omit=dev
   pm2 restart apex-coach
   ```
   cPanel'de: **Run NPM Install**, ardından **Restart**.

## 10. Yedekleme

Tüm ilerlemen `data/` klasöründe. Düzenli olarak indir ya da sunucuda bir zamanlanmış görevle yedekle:

```bash
tar -czf ~/apex-backup-$(date +%F).tar.gz -C ~/apex-coach data
```

## 11. Sorun giderme

| Belirti | Çözüm |
|---|---|
| `APP_SECRET_PIN is not set` ve sunucu kapanıyor | `.env` dosyasında `APP_SECRET_PIN` değerini ayarla. |
| Sayfa açılıyor ama "Offline feedback" yazıyor | `ANTHROPIC_API_KEY` boş. Ekle, sonra `pm2 restart apex-coach`. |
| Coach yanıtları parça parça değil, bir anda geliyor | Proxy tamponlaması açık: Nginx'te `proxy_buffering off;`, Apache'de `flushpackets=on`. |
| Her yeniden başlatmada yeniden giriş istiyor | `APP_SESSION_SECRET` ayarla. |
| `EACCES` veya veri kaydedilmiyor | Node sürecini çalıştıran kullanıcının `data/` klasörüne yazma izni olmalı: `chmod -R u+rw data`. |
| `502 Bad Gateway` | Süreç çalışmıyor ya da port farklı: `pm2 logs apex-coach`, `.env` içindeki `PORT` ile proxy ayarını karşılaştır. |
