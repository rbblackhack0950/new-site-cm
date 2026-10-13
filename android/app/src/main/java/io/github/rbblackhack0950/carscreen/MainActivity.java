package io.github.rbblackhack0950.carscreen;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

/**
 * Car Screen for Android.
 *
 * The whole screen is the Car Screen web app (map, navigation, menus). The media side can show
 * any website in a native browser view laid exactly over the web app's pane. Sites such as
 * m.youtube.com, Netflix or Facebook refuse to load inside another web page, but a native
 * WebView is not "inside a page", so they work here.
 *
 * The web app drives the pane through window.CarScreenNative (see Bridge).
 */
public class MainActivity extends Activity {
    static final String APP_URL = "https://rbblackhack0950.github.io/new-site-cm/?native=1";
    static final String APP_HOST = "rbblackhack0950.github.io";
    static final int REQ_LOCATION = 1;
    static final int MATCH = ViewGroup.LayoutParams.MATCH_PARENT;

    private WebView app;
    private WebView pane;
    private FrameLayout paneBox;
    private View customView;
    private WebChromeClient.CustomViewCallback customCb;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0c0d10"));
        app = new WebView(this);
        root.addView(app, new FrameLayout.LayoutParams(MATCH, MATCH));
        paneBox = new FrameLayout(this);
        paneBox.setBackgroundColor(Color.BLACK);
        paneBox.setVisibility(View.GONE);
        root.addView(paneBox, new FrameLayout.LayoutParams(0, 0));
        setContentView(root);

        setupApp();
        hideSystemBars();
        app.loadUrl(APP_URL);
    }

    // ---------------------------------------------------------------- web app

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void setupApp() {
        WebSettings s = app.getSettings();
        commonSettings(s);
        s.setGeolocationEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(app, true);
        app.addJavascriptInterface(new Bridge(), "CarScreenNative");

        app.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (APP_HOST.equals(u.getHost())) return false;
                // anything else the app links to (Google Maps hand-off, ...) goes to its own app
                openExternal(u.toString());
                return true;
            }
        });
        app.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (hasLocation()) {
                    cb.invoke(origin, true, true);
                } else {
                    geoOrigin = origin;
                    geoCb = cb;
                    requestPermissions(new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
                }
            }
        });
    }

    private void commonSettings(WebSettings s) {
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        // Present as regular Chrome so sites (YouTube, Google sign-in, Netflix) serve their normal site
        s.setUserAgentString(s.getUserAgentString()
                .replace("; wv", "")
                .replaceAll("Version/\\d+(\\.\\d+)* ", ""));
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_LOCATION && geoCb != null) {
            geoCb.invoke(geoOrigin, hasLocation(), true);
            geoCb = null;
        }
    }

    // ---------------------------------------------------------------- media pane

    @SuppressLint("SetJavaScriptEnabled")
    private WebView pane() {
        if (pane != null) return pane;
        pane = new WebView(this);
        commonSettings(pane.getSettings());
        CookieManager.getInstance().setAcceptThirdPartyCookies(pane, true);

        pane.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String scheme = r.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                // "open in app" links (intent://, vnd.youtube:, ...) stay out: use the web fallback if there is one
                if ("intent".equals(scheme)) {
                    try {
                        Intent i = Intent.parseUri(r.getUrl().toString(), Intent.URI_INTENT_SCHEME);
                        String fallback = i.getStringExtra("browser_fallback_url");
                        if (fallback != null) v.loadUrl(fallback);
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }

            @Override
            public void doUpdateVisitedHistory(WebView v, String url, boolean isReload) {
                app.evaluateJavascript("window.__paneUrl && window.__paneUrl(" + JSONObject.quote(url) + ")", null);
            }
        });
        pane.setWebChromeClient(new WebChromeClient() {
            // a video's fullscreen button fills the pane only, never the map side
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                hideCustomView();
                customView = view;
                customCb = cb;
                paneBox.addView(view, new FrameLayout.LayoutParams(MATCH, MATCH));
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }

            // DRM video (Netflix and similar)
            @Override
            public void onPermissionRequest(PermissionRequest req) {
                for (String res : req.getResources()) {
                    if (PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID.equals(res)) {
                        req.grant(new String[]{res});
                        return;
                    }
                }
                req.deny();
            }
        });
        paneBox.addView(pane, 0, new FrameLayout.LayoutParams(MATCH, MATCH));
        return pane;
    }

    private void hideCustomView() {
        if (customView == null) return;
        paneBox.removeView(customView);
        customView = null;
        if (customCb != null) customCb.onCustomViewHidden();
        customCb = null;
    }

    /** Lay the pane over the web app's media area; x, y, w, h are CSS pixels of the web app. */
    private void placePane(float x, float y, float w, float h, boolean show) {
        float d = getResources().getDisplayMetrics().density;
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) paneBox.getLayoutParams();
        lp.leftMargin = Math.round(x * d);
        lp.topMargin = Math.round(y * d);
        lp.width = Math.max(0, Math.round(w * d));
        lp.height = Math.max(0, Math.round(h * d));
        paneBox.setLayoutParams(lp);
        paneBox.setVisibility(show && pane != null && w > 0 && h > 0 ? View.VISIBLE : View.GONE);
    }

    /** Called from the web app as window.CarScreenNative.* (runs off the UI thread). */
    class Bridge {
        @JavascriptInterface
        public String version() {
            return "1";
        }

        @JavascriptInterface
        public void load(String url) {
            runOnUiThread(() -> pane().loadUrl(url));
        }

        @JavascriptInterface
        public void rect(float x, float y, float w, float h, boolean show) {
            runOnUiThread(() -> placePane(x, y, w, h, show));
        }

        @JavascriptInterface
        public void back() {
            runOnUiThread(() -> {
                if (pane != null && pane.canGoBack()) pane.goBack();
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                hideCustomView();
                if (pane != null) pane.loadUrl("about:blank");
                paneBox.setVisibility(View.GONE);
            });
        }

        @JavascriptInterface
        public void external(String url) {
            runOnUiThread(() -> openExternal(url));
        }
    }

    // ---------------------------------------------------------------- system

    private void openExternal(String url) {
        try {
            Intent i = url.startsWith("intent:")
                    ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            i.setComponent(null);
            i.setSelector(null);
            startActivity(i);
        } catch (Exception ignored) {
            // nothing installed can open it
        }
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (customView != null) {
            hideCustomView();
        } else if (pane != null && paneBox.getVisibility() == View.VISIBLE && pane.canGoBack()) {
            pane.goBack();
        } else if (app.canGoBack()) {
            app.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
