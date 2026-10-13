package android.view;
public abstract class ViewGroup extends View {
  public ViewGroup(android.content.Context context) { super(context); }
  public void addView(View child, ViewGroup.LayoutParams params) { throw new RuntimeException("Stub!"); }
  public void addView(View child, int index, ViewGroup.LayoutParams params) { throw new RuntimeException("Stub!"); }
  public void removeView(View view) { throw new RuntimeException("Stub!"); }
  public static class LayoutParams {
    public static final int MATCH_PARENT = -1;
    public int width;
    public int height;
    public LayoutParams(int width, int height) { throw new RuntimeException("Stub!"); }
  }
  public static class MarginLayoutParams extends LayoutParams {
    public int leftMargin;
    public int topMargin;
    public MarginLayoutParams(int width, int height) { super(width, height); }
  }
}
