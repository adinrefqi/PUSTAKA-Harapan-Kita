package com.tunasharapan.pustaka;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.AnimationUtils;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Splash screen elegan untuk Pustaka Tunas Harapan.
 *
 * Menampilkan logo + nama aplikasi di atas latar gradient hijau,
 * dengan animasi fade-in, lalu otomatis membuka MainActivity (WebView).
 */
public class SplashActivity extends AppCompatActivity {

    private static final long DURASI_SPLASH = 1800; // milidetik

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Animasi fade-in untuk konten logo
        View konten = findViewById(R.id.splash_konten);
        konten.startAnimation(AnimationUtils.loadAnimation(this, R.anim.splash_fade_in));

        // Setelah jeda, buka MainActivity lalu tutup splash
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            startActivity(new Intent(SplashActivity.this, MainActivity.class));
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            finish();
        }, DURASI_SPLASH);
    }
}
