package com.harfatolyesi.game;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public final class GameActivity extends Activity {
    private WebView game;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(221, 236, 249));
        if (Build.VERSION.SDK_INT >= 30) {
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(221, 236, 249));
        game.setWebViewClient(new WebViewClient());
        game.getSettings().setJavaScriptEnabled(true);
        game.getSettings().setDomStorageEnabled(true);
        game.getSettings().setAllowContentAccess(false);
        game.getSettings().setMediaPlaybackRequiresUserGesture(true);
        frame.addView(game, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        frame.requestApplyInsets();
        game.loadUrl(gameURL());
    }

    private String gameURL() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(getAssets().open("game-url.txt")))) {
            String url = reader.readLine();
            if (url != null && url.startsWith("https://")) return url;
        } catch (java.io.IOException ignored) {}
        return "file:///android_asset/index.html";
    }

    @Override protected void onPause() { game.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (game != null) game.onResume(); }
}
