package android.view;
public interface WindowInsetsController {
  int BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE = 2;
  void hide(int types);
  void setSystemBarsBehavior(int behavior);
}
