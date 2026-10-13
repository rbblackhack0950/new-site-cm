package android.webkit;
public class WebView extends android.view.ViewGroup {
  public WebView(android.content.Context context) { super(context); }
  public WebSettings getSettings() { throw new RuntimeException("Stub!"); }
  public void addJavascriptInterface(Object object, String name) { throw new RuntimeException("Stub!"); }
  public void setWebViewClient(WebViewClient client) { throw new RuntimeException("Stub!"); }
  public void setWebChromeClient(WebChromeClient client) { throw new RuntimeException("Stub!"); }
  public void loadUrl(String url) { throw new RuntimeException("Stub!"); }
  public void evaluateJavascript(String script, ValueCallback<String> resultCallback) { throw new RuntimeException("Stub!"); }
  public boolean canGoBack() { throw new RuntimeException("Stub!"); }
  public void goBack() { throw new RuntimeException("Stub!"); }
}
