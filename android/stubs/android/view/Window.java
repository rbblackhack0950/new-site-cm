package android.view;
public abstract class Window {
  public static final int FEATURE_NO_TITLE = 1;
  public void addFlags(int flags) { throw new RuntimeException("Stub!"); }
  public WindowInsetsController getInsetsController() { throw new RuntimeException("Stub!"); }
  public abstract View getDecorView();
}
