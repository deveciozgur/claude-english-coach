# Lumos AI English Coach v1.0: Paylaşımlı Hostinge Kurulum

Node.js, PM2, SSH ya da terminal gerekmez. Sunucunda **PHP 7.4+ (cURL eklentisiyle)** çalışıyorsa, dosyaları FTP ile yükleyip bir `.env` dosyası oluşturman yeterli. cPanel, Plesk ve DirectAdmin gibi panellerin neredeyse hepsinde bu hazır gelir.

## Nasıl çalışır?

| Parça | Dosyalar | Görevi |
|---|---|---|
| Arayüz | `index.html`, `_next/`, `icon.svg` | Next.js `output: 'export'` ile üretilmiş statik HTML/JS/CSS. Koçluk mantığı (SM-2, alt bant geçişi, hata defteri, oturum özeti) tarayıcıda çalışır. |
| Sunucu | `api.php`, `config.php` | PIN kontrolü, veri dosyalarını okuma/yazma (`?action=get_state`, `?action=save_state`) ve Gemini bağlantısı (cURL). |
| Kurallar | `CLAUDE.md` | Gemini'ye sistem talimatı olarak gönderilir. |
| Veriler | `data/` | `profile.json`, `vocabulary.md`, `error_ledger.md`, `sessions/`. İlk açılışta `data-seed/` içinden otomatik oluşturulur. Şemalar değişmedi. |

## 1. Paketi al

Hazır paket depoda: **`hosting-release.zip`**. Kendin üretmek istersen:

```powershell
cd C:\Users\halil\english-coach\app
npm ci
npm run build        # out/ klasörünü derler ve ../hosting-release.zip dosyasını oluşturur
```

Zip'in içeriği:

```
index.html  404.html  _next/  icon.svg  robots.txt  *.txt   ← statik arayüz
api.php  config.php                                       ← sunucu tarafı
.htaccess                                                 ← gizli dosyaları korur (gizli dosya!)
.env.example                                              ← ayar şablonu (gizli dosya!)
CLAUDE.md                                                 ← koçluk kuralları
data-seed/                                                ← ilk açılış için verilerin
KURULUM.txt                                               ← kısa kurulum notu
```

## 2. FTP ile yükle

1. Zip'i bilgisayarında aç.
2. İçindeki **her şeyi** sitenin klasörüne yükle. Bu klasör `public_html/` ya da alt alan adının klasörü (örneğin `public_html/coach/` veya `coach.ozgurdeveci.com` için panelin oluşturduğu klasör) olabilir.
3. FTP programında **gizli dosyaları göster** seçeneğini aç. `.htaccess` ve `.env.example` noktayla başladığı için gizlidir ve yüklenmeleri gerekir.

> Uygulama alan adının köküne göre derlendi. En kolayı bir alt alan adı kullanmak (`coach.ozgurdeveci.com`). Bir alt klasörde (örneğin `ozgurdeveci.com/coach`) çalıştırmak istersen paketi `BASE_PATH=/coach npm run build` komutuyla yeniden üret.

## 3. `.env` dosyasını oluştur

Panelin **Dosya Yöneticisi** ile `.env.example` dosyasını kopyala, adını `.env` yap ve düzenle:

```dotenv
APP_SECRET_PIN=buraya-guclu-bir-pin
APP_SESSION_SECRET=uzun-rastgele-bir-metin-4f9a1c...
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-flash-latest
DATA_DIR=data
```

| Değişken | Zorunlu mu | Açıklama |
|---|---|---|
| `APP_SECRET_PIN` | **Evet** | Kilit ekranının istediği PIN/şifre. Boşsa `api.php` hiçbir isteğe yanıt vermez. |
| `APP_SESSION_SECRET` | Önerilir | Giriş çerezini imzalar. Değiştirirsen açık oturumların hepsi kapanır. |
| `GEMINI_API_KEY` | İsteğe bağlı | [Google AI Studio](https://aistudio.google.com/apikey) anahtarı. Coach sohbetini ve AI geri bildirimini açar; yoksa çevrimdışı geri bildirim çalışır. |
| `GEMINI_MODEL` | İsteğe bağlı | Varsayılan `gemini-flash-latest`. |
| `DATA_DIR` | İsteğe bağlı | Veri klasörü. `api.php`'ye göre göreli ya da mutlak yol. |

**Model hakkında:** `gemini-1.5-flash` Google tarafından kapatıldı ve artık yanıt vermiyor. Bu yüzden varsayılan değer, Google'ın her zaman güncel Flash modelini gösteren `gemini-flash-latest` takma adı. Belirli bir model istersen `GEMINI_MODEL` değerini değiştir. Geçersiz bir model adı girersen arayüz bunu açıkça söyler.

**Daha güvenli yerleşim (önerilir):** `.env` dosyasını `public_html`'in **bir üst klasörüne** koyabilirsin. `config.php` orayı da arar. İstersen `DATA_DIR=/home/KULLANICI/lumos-data` ile verileri de web kökünün dışına taşıyabilirsin.

## 4. Siteyi aç

1. `https://coach.ozgurdeveci.com` adresine git ve PIN'ini gir.
2. İlk istekte `data/` klasörü `data-seed/` içinden otomatik oluşur ve korunur.
3. Oturum 30 gün açık kalır. Sağ üstteki kilit simgesiyle kapatabilirsin.

Klasör izin hatası alırsan Dosya Yöneticisi'nde site klasörüne yazma izni ver (genelde 755), ya da `data/` klasörünü kendin oluştur.

## 5. Güvenlik kontrolü (önemli)

Kurulumdan sonra tarayıcıda şu adresleri aç. Hepsi **403 Forbidden** (veya 404) vermeli:

```
https://coach.ozgurdeveci.com/.env
https://coach.ozgurdeveci.com/config.php
https://coach.ozgurdeveci.com/CLAUDE.md
https://coach.ozgurdeveci.com/data/profile.json
https://coach.ozgurdeveci.com/data-seed/profile.json
```

Bu koruma `.htaccess` ile sağlanır (Apache ve LiteSpeed). Sunucun yalnızca **Nginx** kullanıyorsa `.htaccess` okunmaz. O durumda `.env` dosyasını ve `data/` klasörünü web kökünün dışına taşı (3. adımdaki "daha güvenli yerleşim").

Diğer önlemler:
- **PIN kontrolü:** PIN sunucuda `hash_equals` ile sabit sürede karşılaştırılır.
- **Oturum çerezi:** Doğru PIN, imzalı (HMAC-SHA256), `HttpOnly` ve `SameSite=Strict` bir `lumos_auth` çerezi oluşturur; HTTPS'te `Secure` işaretlenir.
- **Deneme sınırı:** Aynı IP'den 5 yanlış PIN o IP'yi 15 dakika kilitler. Tüm IP'lerden toplam 30 yanlış deneme herkesi 15 dakika kilitler. IP olarak `REMOTE_ADDR` kullanılır; istemci bunu başlıklarla taklit edemez.
- **Kaydetme:** `save_state` yalnızca `profile.json`, `vocabulary.md`, `error_ledger.md` ve `sessions/YYYY-MM-DD.md` dosyalarını yazar. `profile.json` geçerli JSON değilse reddedilir.
- **Başka sitelerden gelen istekler:** POST istekleri `X-Requested-With: lumos` başlığı ister; bu, başka sitelerden gönderilen formları engeller.
- **Çoklu cihaz:** Her kayıtta bir sürüm numarası kontrol edilir. İki cihaz aynı anda kaydederse biri 409 alır ve güncel veriyi yükleyip tekrar dener; veriler üst üste yazılmaz.

## 6. Güncelleme

1. Yeni `hosting-release.zip` dosyasını aç.
2. İçindekileri FTP ile yükle, **ama `.env` dosyasının ve `data/` klasörünün üzerine yazma**. Zip'te `data/` yok, sadece `data-seed/` var. Bu yüzden normal bir yükleme ilerlemeni zaten silmez.

## 7. Yedekleme

- **Otomatik:** `api.php` her gün ilk kayıttan önce `data/backups/YYYY-MM-DD/` altına bir kopya alır ve son 14 günü saklar.
- **Elle:** Dosya Yöneticisi'nden `data/` klasörünü zip'leyip indir.

## 8. Sorun giderme

| Belirti | Çözüm |
|---|---|
| "Lumos cannot reach its data" ve "APP_SECRET_PIN is not set" | `.env` dosyası yok ya da adı yanlış (`.env.txt` olmamalı). |
| "api.php did not answer with JSON" | PHP kapalı ya da sürümü çok eski. Panelden PHP 7.4 veya üstünü seç. |
| "Cannot create the data folder" | Site klasörüne yazma izni ver ya da `data/` klasörünü elle oluştur (755). |
| Coach "Gemini rejected the API key" diyor | `GEMINI_API_KEY` yanlış ya da bu anahtarda Gemini API kapalı. |
| Coach "model was not found" diyor | `GEMINI_MODEL` değerini düzelt (örneğin `gemini-flash-latest`). |
| Coach yanıtı bir anda geliyor | Host çıktıyı tamponluyor. Yine çalışır, sadece akış efekti olmaz. |
| Header'da "Offline feedback" yazıyor | `GEMINI_API_KEY` boş. Çevrimdışı geri bildirim yine çalışır. |
