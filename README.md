# 🌱 Pustaka Tunas Harapan

Aplikasi manajemen perpustakaan sekolah untuk **SMP Tunas Hidup Harapan Kita**.
Dibuat dengan **HTML + CSS + JavaScript murni** (tanpa framework, tanpa build tool)
dan **Supabase** sebagai backend (database + REST API otomatis).

Bisa langsung diuji dengan **membuka `index.html` di browser**, lalu dibungkus
menjadi **WebView** untuk laptop dan Android.

---

## 📁 Struktur File

```
PUSTAKA Tunas Harapan/
├── index.html        Halaman utama + navigasi tab
├── config.js         Isi SUPABASE_URL & SUPABASE_ANON_KEY di sini
├── app.js            Semua logika: CRUD buku/anggota + peminjaman
├── style.css         Tema hijau-putih, mobile-first
├── database.sql      Script tabel + data dummy untuk Supabase
├── README.md         File ini
└── android/          Proyek Android WebView minimal
    └── app/src/main/
        ├── AndroidManifest.xml
        ├── java/com/tunasharapan/pustaka/MainActivity.java
        ├── java/com/tunasharapan/pustaka/SplashActivity.java
        ├── res/layout/activity_main.xml
        ├── res/layout/activity_splash.xml
        ├── res/drawable/splash_background.xml, splash_logo_bg.xml
        ├── res/drawable/ic_launcher_background.xml, ic_launcher_foreground.xml
        ├── res/mipmap-anydpi-v26/ic_launcher.xml, ic_launcher_round.xml
        ├── res/anim/splash_fade_in.xml
        ├── res/values/styles.xml
        └── assets/www/   (salin file web ke sini)
```

---

## 🚀 Langkah Pemasangan (5 langkah)

### 1. Buat project di Supabase & ambil URL + anon key
1. Buka <https://supabase.com> → **Sign in** (gratis).
2. Klik **New Project**, isi nama (mis. `pustaka-tunas-harapan`), pilih region
   terdekat (Singapore), buat password database, lalu **Create new project**.
3. Tunggu ±1 menit sampai project siap.
4. Buka menu **Project Settings** (ikon gerigi ⚙️) → **API**.
5. Salin dua nilai ini:
   - **Project URL** → contoh `https://abcd1234.supabase.co`
   - **anon public** key → string panjang `eyJ...`

### 2. Isi `config.js`
Buka `config.js`, ganti dua baris berikut dengan nilai milikmu:

```js
const SUPABASE_URL = "https://abcd1234.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...isi-anon-key-kamu...";
```

> anon key memang ditaruh di sisi klien — itu normal dan aman selama RLS aktif.

### 3. Jalankan `database.sql`
1. Di Supabase, buka menu **SQL Editor** → **New query**.
2. Buka file `database.sql`, **copy seluruh isinya**, paste ke editor.
3. Klik **Run** (atau `Ctrl+Enter`).
4. Akan terbuat tabel `buku`, `anggota`, `peminjaman` beserta data dummy.

> Script ini mengaktifkan **RLS** dengan policy **"allow all"** supaya mudah
> diuji memakai anon key. **Saat produksi**, hapus policy tersebut dan buat
> policy yang lebih ketat (lihat komentar di dalam `database.sql`).

### 4. Uji dengan membuka `index.html`
- Cukup **klik dua kali `index.html`** → terbuka di browser (Chrome/Edge/Firefox).
- Tidak perlu server lokal atau Node.js.
- Jika konfigurasi benar, Dashboard akan menampilkan jumlah buku, anggota,
  dan buku yang sedang dipinjam.

> Jika muncul peringatan kuning "Isi dulu config.js", berarti `config.js`
> belum diisi dengan benar.

### 5. (Opsional) Bungkus jadi Android WebView — lihat bawah.

---

## 📱 Membungkus jadi Aplikasi Android (WebView)

Kode Android minimal sudah disediakan di folder `android/`.

### Langkah singkat
1. **Install Android Studio** (gratis).
2. Buat project baru: **Empty Views Activity** → Language **Java**
   → Package name: `com.tunasharapan.pustaka`.
3. **Timpa / salin file** hasil generate dengan file dari folder `android/` ini:
   - `MainActivity.java`
   - `SplashActivity.java`  *(splash screen)*
   - `res/layout/activity_main.xml`
   - `res/layout/activity_splash.xml`  *(splash screen)*
   - `res/drawable/splash_background.xml`, `res/drawable/splash_logo_bg.xml`
   - `res/anim/splash_fade_in.xml`
   - `res/values/styles.xml`  *(berisi `SplashTheme`)*
   - `res/drawable/ic_launcher_background.xml`, `ic_launcher_foreground.xml`  *(ikon)*
   - `res/mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml`  *(ikon)*
   - `AndroidManifest.xml`

   > **Ikon launcher** bertema tunas daun sudah disertakan sebagai *adaptive icon*
   > vektor. Jika Android Studio meng-generate `mipmap-*/ic_launcher.png` bawaan,
   > biarkan saja — versi `anydpi-v26` (vektor) yang akan dipakai di Android 8+.
   > Hapus PNG bawaan bila ingin ikon vektor dipakai di semua perangkat.
4. Buat folder `app/src/main/assets/www/` lalu **salin 4 file web** ke dalamnya:
   `index.html`, `config.js`, `app.js`, `style.css`
   (pastikan `config.js` sudah berisi URL & anon key).
5. Pastikan dependency `androidx.appcompat` ada di `app/build.gradle`:
   ```gradle
   dependencies {
       implementation 'androidx.appcompat:appcompat:1.6.1'
   }
   ```
6. Klik **Run ▶** untuk menjalankan di emulator / HP Android.

### Cara kerja
`MainActivity` memuat `file:///android_asset/www/index.html` di dalam WebView,
dengan JavaScript & DOM storage diaktifkan, dan izin INTERNET agar bisa konek
ke Supabase.

> **Alternatif tanpa assets:** host file web di Netlify/Vercel/GitHub Pages,
> lalu di `MainActivity.java` ganti `URL_LOKAL` dengan URL hosting tersebut.

---

## 💻 Membungkus jadi Aplikasi Laptop (opsional)

Cara paling sederhana: **cukup buka `index.html` di browser** — sudah cukup
untuk pengujian dan pemakaian sehari-hari.

Ingin jadi aplikasi desktop sungguhan? Bisa pakai **Tauri**:
```bash
npm create tauri-app@latest
# arahkan "frontendDist" ke folder berisi index.html, lalu:
npm run tauri build
```
Atau pakai cara termudah lain: buat shortcut Chrome dengan mode aplikasi
(`chrome.exe --app=file:///path/index.html`).

---

## 🔑 Login

Aplikasi dibuka dengan halaman login sederhana:

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |

Status login disimpan di browser (tetap masuk sampai menekan tombol **🚪 Keluar**
di header). Ubah kredensial lewat konstanta `LOGIN_USER` & `LOGIN_PASS` di `app.js`.

> **Catatan keamanan:** ini login sisi-klien sederhana (kredensial ada di kode) —
> hanya untuk membatasi akses petugas saat pengujian, **bukan** keamanan
> sungguhan. Untuk produksi, gunakan **Supabase Auth** + RLS berbasis peran.

## ✨ Fitur

- **Dashboard** — total judul buku, total anggota, sedang dipinjam, dan **terlambat**.
- **Buku** — lihat daftar, cari berdasarkan judul, tambah, edit, hapus, **ekspor CSV**,
  **cetak label/barcode** buku (tombol 🏷️) untuk ditempel di sampul — bisa per buku
  atau **cetak semua sekaligus** (mengikuti hasil pencarian). Kode buku: `BUK<id>`.
- **Anggota** — lihat daftar, cari nama, tambah, edit, hapus, **ekspor CSV**,
  **cetak kartu anggota** ber-**QR code & barcode** (encode NIS).
- **Peminjaman**
  - Pinjam buku (pilih anggota + buku) → **stok berkurang otomatis**.
  - **Scan QR / barcode** kartu anggota lewat kamera (tombol 📷) untuk
    memilih anggota otomatis; tersedia juga input NIS manual sebagai cadangan.
  - **Tanggal jatuh tempo otomatis** (default 7 hari) dengan penanda
    *Sisa N hari* / *Jatuh tempo hari ini* / *Terlambat N hari*.
  - **Denda keterlambatan otomatis** (default Rp500/hari) — perkiraan denda
    tampil di item terlambat, denda final dihitung saat buku dikembalikan.
  - Kembalikan buku → status jadi `kembali`, **stok bertambah otomatis**.
  - Sub-tab **Sedang Dipinjam** & **Riwayat** (pengembalian, label
    *tepat waktu* / *terlambat*, denda per item, **total denda terkumpul**).
  - **Ekspor CSV** seluruh data peminjaman.
  - **Cetak struk** peminjaman & pengembalian (tombol 🖨️) — bisa ke printer
    atau *Save as PDF* lewat dialog cetak browser.
- Navigasi tab (single page, tanpa reload) — *bottom nav* mengambang di HP,
  *pill bar* di atas pada layar lebar, dengan **transisi geser terarah**
  (kiri/kanan mengikuti arah perpindahan) dan animasi *stagger* pada daftar.
- Tampilan **premium mobile-first**: font Google, gradient hijau, glassmorphism,
  animasi halus, tombol besar.
- **Efek ripple** (Material-style) saat tombol/tab ditekan, dan **angka dashboard
  menghitung naik** (count-up) saat dibuka.
- **Pull-to-refresh**: tarik layar ke bawah (di HP/WebView) untuk memuat ulang
  data tab yang sedang aktif.
- **Skeleton loading**: placeholder berkilau (*shimmer*) saat daftar sedang dimuat.
- **Mode gelap / terang** (tombol 🌙/☀️ di header) — pilihan tersimpan otomatis
  dan mengikuti preferensi sistem saat pertama dibuka.
- **Splash screen** elegan di aplikasi Android (logo + gradient + animasi).

> Lama peminjaman & tarif denda bisa diubah lewat konstanta `LAMA_PINJAM_HARI`
> dan `TARIF_DENDA` di bagian atas `app.js`.

> **Ekspor CSV** menghasilkan file (`buku.csv`, `anggota.csv`, `peminjaman.csv`)
> yang langsung terunduh di browser laptop, siap dibuka di Excel/Google Sheets.
> Di **Android WebView**, unduhan dari tombol CSV mungkin tidak otomatis terbuka
> (keterbatasan WebView terhadap `blob:`); untuk laporan, ekspor sebaiknya
> dilakukan dari browser laptop.

---

## 🔒 Catatan Keamanan (Produksi)

Policy database saat ini **"allow all"** — hanya untuk mempermudah pengujian.
Sebelum dipakai sungguhan:
1. Hapus policy "allow all" di `database.sql`.
2. Aktifkan **Supabase Auth** (login petugas).
3. Buat policy RLS berbasis `auth.uid()` / role.
4. Operasi stok idealnya dipindah ke **Postgres function (RPC)** agar atomik.

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---|---|
| Dashboard 0 semua & ada peringatan kuning | `config.js` belum diisi benar |
| Error "relation does not exist" | `database.sql` belum dijalankan di Supabase |
| Data tidak muncul padahal ada | Pastikan RLS policy "allow all" aktif (jalankan ulang `database.sql`) |
| Android: layar putih | Pastikan 4 file web ada di `assets/www/` & izin INTERNET ada |
| CORS / network error | Cek URL Supabase benar dan koneksi internet aktif |
| Kamera scan tidak muncul | Browser butuh **HTTPS** atau **localhost** untuk akses kamera. Buka via hosting (Netlify/Vercel) atau `localhost`, bukan `file://`. Di Android WebView sudah ditangani (izin kamera). Selalu ada **input NIS manual** sebagai cadangan. |

---

Selamat menggunakan **Pustaka Tunas Harapan** 🌱
