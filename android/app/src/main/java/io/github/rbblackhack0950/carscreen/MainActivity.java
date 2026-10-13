package io.github.rbblackhack0950.carscreen;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
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

import android.app.PendingIntent;
import android.content.pm.PackageInstaller;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

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
    static final String MAPS_PACKAGE = "com.google.android.apps.maps";
    static final String ACTION_INSTALL_STATUS = "io.github.rbblackhack0950.carscreen.INSTALL_STATUS";

    private WebView app;
    private WebView pane;
    private FrameLayout paneBox;
    private View customView;
    private WebChromeClient.CustomViewCallback customCb;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private volatile String userAgent; // read on the UI thread, used by background requests

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            // use the whole screen, including the strip beside a camera notch (the page keeps its content clear of it)
            WindowManager.LayoutParams wa = getWindow().getAttributes();
            wa.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(wa);
        }

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

    private void setupApp() {
        WebSettings s = app.getSettings();
        commonSettings(s);
        userAgent = s.getUserAgentString();
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
        public void load(final String url) {
            runOnUiThread(new Runnable() {
                public void run() { pane().loadUrl(url); }
            });
        }

        @JavascriptInterface
        public void rect(final float x, final float y, final float w, final float h, final boolean show) {
            runOnUiThread(new Runnable() {
                public void run() { placePane(x, y, w, h, show); }
            });
        }

        @JavascriptInterface
        public void back() {
            runOnUiThread(new Runnable() {
                public void run() { if (pane != null && pane.canGoBack()) pane.goBack(); }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(new Runnable() {
                public void run() {
                    hideCustomView();
                    if (pane != null) pane.loadUrl("about:blank");
                    paneBox.setVisibility(View.GONE);
                }
            });
        }

        @JavascriptInterface
        public void external(final String url) {
            runOnUiThread(new Runnable() {
                public void run() { openExternal(url); }
            });
        }

        /** Open the Google Maps app next to Car Screen (split screen), e.g. google.navigation:q=13.7,100.5 */
        @JavascriptInterface
        public void mapsAdjacent(final String uri) {
            runOnUiThread(new Runnable() {
                public void run() { launchMapsAdjacent(uri); }
            });
        }

        @JavascriptInterface
        public boolean inSplitScreen() {
            return isInMultiWindowMode();
        }

        /** GET a URL outside the browser's rules (CORS, redirects); answers window.__http(id, status, finalUrl, body) */
        @JavascriptInterface
        public void httpGet(final int id, final String url) {
            new Thread(new Runnable() {
                public void run() { fetchForPage(id, url); }
            }).start();
        }

        /** Installed app version, compared by the web app with dist/version.json */
        @JavascriptInterface
        public int appVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 0;
            }
        }

        /** Download a new APK, check its SHA-256 and hand it to Android's installer */
        @JavascriptInterface
        public void update(final String url, final String sha256) {
            new Thread(new Runnable() {
                public void run() { installUpdate(url, sha256); }
            }).start();
        }
    }

    // ---------------------------------------------------------------- self update

    private void installUpdate(String url, String sha256) {
        PackageInstaller.Session session = null;
        try {
            updateStatus("download", "กำลังดาวน์โหลดแอปเวอร์ชันใหม่…");
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            c.setUseCaches(false);
            if (c.getResponseCode() != 200) throw new IOException("ดาวน์โหลดไม่สำเร็จ (HTTP " + c.getResponseCode() + ")");
            byte[] apk = readAll(c.getInputStream());
            if (sha256 != null && sha256.length() > 0 && !sha256.equalsIgnoreCase(hex(MessageDigest.getInstance("SHA-256").digest(apk)))) {
                throw new IOException("ไฟล์ที่ดาวน์โหลดไม่ตรงกับที่ประกาศไว้ ลองใหม่อีกครั้ง");
            }
            // keep a copy for the installer screen fallback
            java.io.FileOutputStream copy = new java.io.FileOutputStream(new java.io.File(getCacheDir(), ApkProvider.FILE));
            copy.write(apk);
            copy.close();
            updateStatus("install", "กำลังติดตั้ง…");
            PackageInstaller installer = getPackageManager().getPackageInstaller();
            int id = installer.createSession(new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL));
            session = installer.openSession(id);
            OutputStream out = session.openWrite("car-screen.apk", 0, apk.length);
            out.write(apk);
            session.fsync(out);
            out.close();
            Intent result = new Intent(this, MainActivity.class).setAction(ACTION_INSTALL_STATUS);
            PendingIntent pending = PendingIntent.getActivity(this, 1, result,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            session.commit(pending.getIntentSender());
            session.close();
        } catch (Exception e) {
            if (session != null) session.abandon();
            updateStatus("error", e.getMessage() != null ? e.getMessage() : e.toString());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, 1);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // Android asks the user to confirm (and, the first time, to allow installs from this app)
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) startActivity(confirm);
            updateStatus("confirm", "กด “ติดตั้ง” เพื่อยืนยันการอัปเดต");
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            updateStatus("done", "อัปเดตแล้ว");
        } else if (new java.io.File(getCacheDir(), ApkProvider.FILE).exists()) {
            // background install refused (e.g. HyperOS blocks self-updates): use the system installer screen
            openInstallerScreen();
        } else {
            String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            updateStatus("error", "ติดตั้งไม่สำเร็จ" + (msg != null ? " (" + msg + ")" : ""));
        }
    }

    private void openInstallerScreen() {
        Intent view = new Intent(Intent.ACTION_VIEW, null);
        view.setDataAndType(ApkProvider.URI, "application/vnd.android.package-archive");
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(view);
            updateStatus("confirm", "เปิดหน้าติดตั้งของระบบแล้ว กด “ติดตั้ง” เพื่ออัปเดต");
        } catch (Exception e) {
            updateStatus("error", "ระบบไม่ยอมให้แอปติดตั้งเอง");
        }
    }

    private void fetchForPage(final int id, String url) {
        int status = 0;
        String finalUrl = url, body = "";
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            if (userAgent != null) c.setRequestProperty("User-Agent", userAgent);
            status = c.getResponseCode();
            finalUrl = c.getURL().toString();
            InputStream in = status < 400 ? c.getInputStream() : c.getErrorStream();
            if (in != null) {
                byte[] data = readAll(in);
                body = new String(data, 0, Math.min(data.length, 2 * 1024 * 1024), "UTF-8");
            }
        } catch (Exception ignored) {
        }
        final String js = "window.__http && window.__http(" + id + "," + status + ","
                + JSONObject.quote(finalUrl) + "," + JSONObject.quote(body) + ")";
        runOnUiThread(new Runnable() {
            public void run() { app.evaluateJavascript(js, null); }
        });
    }

    private void updateStatus(final String state, final String message) {
        runOnUiThread(new Runnable() {
            public void run() {
                app.evaluateJavascript("window.__appUpdate && window.__appUpdate("
                        + JSONObject.quote(state) + "," + JSONObject.quote(message) + ")", null);
            }
        });
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[16384];
        for (int n; (n = in.read(chunk)) != -1; ) buf.write(chunk, 0, n);
        in.close();
        return buf.toByteArray();
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private void launchMapsAdjacent(String uri) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        i.setPackage(MAPS_PACKAGE);
        // LAUNCH_ADJACENT puts Maps in the other half when split screen is available
        i.addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (Exception notInstalled) {
            openExternal("https://www.google.com/maps");
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
