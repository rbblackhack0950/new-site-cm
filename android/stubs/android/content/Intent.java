package android.content;
public class Intent {
  public static final String ACTION_VIEW = "android.intent.action.VIEW";
  public static final String CATEGORY_BROWSABLE = "android.intent.category.BROWSABLE";
  public static final int URI_INTENT_SCHEME = 1;
  public static final int FLAG_ACTIVITY_LAUNCH_ADJACENT = 0x00001000;
  public static final int FLAG_ACTIVITY_NEW_TASK = 0x10000000;
  public Intent(String action, android.net.Uri uri) { throw new RuntimeException("Stub!"); }
  public static Intent parseUri(String uri, int flags) throws java.net.URISyntaxException { throw new RuntimeException("Stub!"); }
  public Intent addCategory(String category) { throw new RuntimeException("Stub!"); }
  public Intent addFlags(int flags) { throw new RuntimeException("Stub!"); }
  public Intent setPackage(String packageName) { throw new RuntimeException("Stub!"); }
  public Intent setComponent(ComponentName component) { throw new RuntimeException("Stub!"); }
  public void setSelector(Intent selector) { throw new RuntimeException("Stub!"); }
  public String getStringExtra(String name) { throw new RuntimeException("Stub!"); }
}
