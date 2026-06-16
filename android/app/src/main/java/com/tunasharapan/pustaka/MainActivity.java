package com.tunasharapan.pustaka;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Pustaka Tunas Harapan — Android WebView sederhana.
 *
 * Memuat aplikasi web yang sudah di-hosting di Vercel (HTTPS).
 * Keuntungan memakai URL hosting:
 *  - Kamera scan QR/barcode langsung berfungsi (butuh konteks aman HTTPS).
 *  - Update web otomatis tanpa perlu build ulang APK.
 *
 * (Alternatif offline: taruh file web di app/src/main/assets/www/ lalu pakai
 *  "file:///android_asset/www/index.html".)
 */
public class MainActivity extends AppCompatActivity {

    // Alamat aplikasi web (hosting Vercel)
    private static final String URL_APLIKASI = "https://pustakathhk.vercel.app/";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);          // wajib untuk app.js
        settings.setDomStorageEnabled(true);          // localStorage (dipakai supabase)
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Biar link tetap dibuka di dalam WebView
        webView.setWebViewClient(new WebViewClient());

        // WebChromeClient: izinkan halaman web memakai kamera (untuk scanner QR/barcode)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        // Minta izin kamera ke sistem Android jika belum diberikan
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{ Manifest.permission.CAMERA }, 1);
        }

        webView.loadUrl(URL_APLIKASI);
    }

    /** Tombol "back" perangkat -> navigasi mundur di WebView. */
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
