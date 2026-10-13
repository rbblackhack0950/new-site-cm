package android.webkit;
public abstract class CookieManager {
  public static CookieManager getInstance() { throw new RuntimeException("Stub!"); }
  public abstract void setAcceptCookie(boolean accept);
  public abstract void setAcceptThirdPartyCookies(WebView webview, boolean accept);
}
