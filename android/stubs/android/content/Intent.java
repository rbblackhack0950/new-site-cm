package android.content;
public class Intent implements android.os.Parcelable {
  public static final String EXTRA_INTENT = "android.intent.extra.INTENT";
  public static final String ACTION_VIEW = "android.intent.action.VIEW";
  public static final String CATEGORY_BROWSABLE = "android.intent.category.BROWSABLE";
  public static final int URI_INTENT_SCHEME = 1;
  public static final int FLAG_ACTIVITY_LAUNCH_ADJACENT = 0x00001000;
  public static final int FLAG_ACTIVITY_NEW_TASK = 0x10000000;
  public static final int FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
  public Intent(Context packageContext, Class<?> cls) { throw new RuntimeException("Stub!"); }
  public Intent setDataAndType(android.net.Uri data, String type) { throw new RuntimeException("Stub!"); }
  public Intent setAction(String action) { throw new RuntimeException("Stub!"); }
  public String getAction() { throw new RuntimeException("Stub!"); }
  public int getIntExtra(String name, int defaultValue) { throw new RuntimeException("Stub!"); }
  public <T extends android.os.Parcelable> T getParcelableExtra(String name) { throw new RuntimeException("Stub!"); }
  public Intent(String action, android.net.Uri uri) { throw new RuntimeException("Stub!"); }
  public static Intent parseUri(String uri, int flags) throws java.net.URISyntaxException { throw new RuntimeException("Stub!"); }
  public Intent addCategory(String category) { throw new RuntimeException("Stub!"); }
  public Intent addFlags(int flags) { throw new RuntimeException("Stub!"); }
  public Intent setPackage(String packageName) { throw new RuntimeException("Stub!"); }
  public Intent setComponent(ComponentName component) { throw new RuntimeException("Stub!"); }
  public void setSelector(Intent selector) { throw new RuntimeException("Stub!"); }
  public String getStringExtra(String name) { throw new RuntimeException("Stub!"); }
}
