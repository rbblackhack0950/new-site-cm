package android.view;
public interface WindowManager {
  public static class LayoutParams {
    public static final int FLAG_KEEP_SCREEN_ON = 0x00000080;
    public static final int FLAG_FULLSCREEN = 0x00000400;
    public static final int LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES = 1;
    public int layoutInDisplayCutoutMode;
  }
}
