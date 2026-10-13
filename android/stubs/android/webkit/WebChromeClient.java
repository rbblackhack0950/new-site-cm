package android.webkit;
public class WebChromeClient {
  public WebChromeClient() { throw new RuntimeException("Stub!"); }
  public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) { throw new RuntimeException("Stub!"); }
  public void onShowCustomView(android.view.View view, CustomViewCallback callback) { throw new RuntimeException("Stub!"); }
  public void onHideCustomView() { throw new RuntimeException("Stub!"); }
  public void onPermissionRequest(PermissionRequest request) { throw new RuntimeException("Stub!"); }
  public interface CustomViewCallback { void onCustomViewHidden(); }
}
