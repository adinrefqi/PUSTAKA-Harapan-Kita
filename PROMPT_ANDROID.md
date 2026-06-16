# Prompt untuk AI Agent di Android Studio

Aplikasi web sudah di-hosting di: **https://pustakathhk.vercel.app/**
Jadi aplikasi Android cukup membungkus URL tersebut dengan WebView (lebih simpel,
kamera scan langsung jalan karena HTTPS, dan update web otomatis tanpa rebuild APK).

Salin seluruh teks di dalam blok di bawah ini, lalu tempel ke AI agent
(Gemini / Copilot / dsb.) di Android Studio.

---

```
Buatkan saya sebuah aplikasi Android (bahasa Java, WAJIB Java bukan Kotlin) yang
membungkus sebuah website dengan WebView. Aplikasi bernama "Pustaka Tunas Harapan" —
aplikasi perpustakaan sekolah untuk SMP Tunas Hidup Harapan Kita.

## Spesifikasi Umum
- Bahasa: Java (bukan Kotlin).
- Template: Empty Views Activity.
- Package name / applicationId: com.tunasharapan.pustaka
- minSdk 24, targetSdk 34 (atau terbaru yang tersedia).
- Gunakan AndroidX (androidx.appcompat:appcompat).
- Aplikasi memuat WEBSITE dari URL berikut (hosting Vercel, HTTPS):
    https://pustakathhk.vercel.app/

## 1) MainActivity (WebView)
- Layout activity_main.xml: satu WebView (id: webview) memenuhi layar penuh
  (match_parent x match_parent), tanpa ActionBar.
- Muat URL: https://pustakathhk.vercel.app/
- Aktifkan pengaturan WebView berikut:
  - JavaScriptEnabled = true
  - DomStorageEnabled = true (untuk localStorage; dipakai login & tema)
  - DatabaseEnabled = true
  - setLoadWithOverviewMode(true), setUseWideViewPort(true)
  - cacheMode = LOAD_DEFAULT
- Pasang WebViewClient agar semua link/navigasi tetap terbuka DI DALAM WebView
  (tidak lompat ke browser luar).
- Tombol Back perangkat: jika webView.canGoBack() maka goBack(), selain itu keluar
  aplikasi seperti biasa.

## 2) Dukungan Kamera (untuk fitur Scan QR/Barcode di web)
Website memakai kamera (getUserMedia) untuk memindai QR/barcode kartu anggota.
Agar berfungsi di WebView:
- Tambahkan permission di AndroidManifest:
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
- Pasang WebChromeClient yang meng-override onPermissionRequest() dan memanggil
  request.grant(request.getResources()) di UI thread, sehingga halaman web boleh
  mengakses kamera.
- Di onCreate, minta izin kamera runtime (ActivityCompat.requestPermissions)
  jika belum diberikan (Manifest.permission.CAMERA).

## 3) Splash Screen (tampil saat aplikasi dibuka)
- Buat SplashActivity yang menjadi LAUNCHER (activity pembuka), lalu setelah
  ~1,8 detik membuka MainActivity dan finish().
- Tampilan splash: latar GRADIENT HIJAU (forest #0F5132 -> emerald #0F9D58 -> #0A3622),
  di tengah ada LOGO dari file gambar res/drawable/logo.png (pakai ImageView,
  ukuran ~130dp, scaleType fitCenter, di dalam lingkaran semi-transparan),
  lalu teks "Pustaka Tunas Harapan" (putih, bold) dan subjudul
  "SMP Tunas Hidup Harapan Kita". Di bawah layar teks kecil "Perpustakaan Digital Sekolah".
  CATATAN: saya akan menaruh file logo.png di res/drawable/logo.png — gunakan itu,
  JANGAN pakai emoji.
- Beri animasi fade-in + sedikit naik + zoom halus pada konten logo.
- Buat SplashTheme yang memakai gradient sebagai android:windowBackground agar
  tidak ada kedip putih sebelum layout tampil. statusBarColor & navigationBarColor
  = #0A3622.
- MainActivity diset android:exported="false"; SplashActivity exported="true"
  dengan intent-filter MAIN/LAUNCHER.

## 4) Launcher Icon (ikon aplikasi) — pakai logo.png
- Ikon aplikasi HARUS memakai file logo.png saya (res/drawable/logo.png),
  BUKAN ikon daun bawaan/vektor.
- Buat adaptive launcher icon:
  - Background: gradient hijau (forest -> emerald) sebagai vector drawable
    (ic_launcher_background.xml).
  - Foreground: logo.png yang di-inset ~22dp dari tepi agar berada di area aman
    kanvas 108dp. Buat drawable foreground seperti ini:
        <inset xmlns:android="http://schemas.android.com/apk/res/android"
            android:drawable="@drawable/logo"
            android:insetLeft="22dp" android:insetTop="22dp"
            android:insetRight="22dp" android:insetBottom="22dp" />
  - Daftarkan sebagai mipmap-anydpi-v26/ic_launcher.xml dan ic_launcher_round.xml
    (adaptive-icon: background = gradient, foreground = inset logo).
- Set android:icon dan android:roundIcon di AndroidManifest ke @mipmap/ic_launcher
  dan @mipmap/ic_launcher_round.
- Label aplikasi: "Pustaka Tunas Harapan".
- ALTERNATIF (lebih rapi untuk semua versi Android): saya bisa pakai
  Image Asset Studio (klik kanan folder res -> New -> Image Asset -> pilih logo.png)
  untuk generate ikon di semua kepadatan. Sebutkan ini sebagai opsi ke saya.

## 5) Lain-lain
- Pastikan build.gradle (app) punya: implementation 'androidx.appcompat:appcompat:1.6.1'
- Aplikasi harus bisa langsung di-Run ke emulator/HP dan menampilkan website.
- Butuh izin INTERNET (memuat website + konek Supabase + library CDN).
- Tidak perlu folder assets; semua dimuat dari URL.

Tolong buatkan SEMUA file yang diperlukan lengkap dengan kodenya:
- AndroidManifest.xml
- MainActivity.java
- SplashActivity.java
- res/layout/activity_main.xml
- res/layout/activity_splash.xml
- res/drawable/splash_background.xml (gradient)
- res/drawable/splash_logo_bg.xml (lingkaran semi-transparan)
- res/anim/splash_fade_in.xml
- res/values/styles.xml (berisi SplashTheme)
- res/drawable/ic_launcher_background.xml & ic_launcher_foreground.xml
- res/mipmap-anydpi-v26/ic_launcher.xml & ic_launcher_round.xml
- Sesuaikan build.gradle bila perlu.

Setelah selesai, beri saya instruksi singkat cara menjalankan aplikasinya.
```

---

## Catatan penggunaan

1. **WAJIB: salin `logo.png` ke `app/src/main/res/drawable/logo.png`** sebelum build —
   dipakai untuk splash screen DAN ikon aplikasi. (Tips: kompres dulu agar < 500 KB
   supaya APK ringan; logo.png saat ini ~2 MB.)

2. **Tidak perlu menyalin file web lain** — semuanya dimuat dari
   URL https://pustakathhk.vercel.app/ . Cukup build & Run.

2. Folder `android/` di project ini berisi **referensi kode jadi** (MainActivity
   sudah diset memuat URL Vercel) — kalau output AI agent meleset, bandingkan /
   salin langsung dari sana.

3. Kamera scan QR/barcode kini berfungsi penuh karena dimuat lewat HTTPS.
   Tetap ada input NIS manual sebagai cadangan.

4. Karena memuat dari URL, **setiap kali kamu update & deploy ulang ke Vercel,
   aplikasi Android otomatis ikut ter-update** (tidak perlu build APK lagi).

5. Login aplikasi: **admin / admin**.
