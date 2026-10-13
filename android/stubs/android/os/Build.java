package android.os;
public class Build {
  public static class VERSION {
    // not a compile-time constant, so the real value is read on the device
    public static final int SDK_INT = Integer.parseInt("0");
  }
}
