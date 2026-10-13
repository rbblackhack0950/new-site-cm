package android.net;
public abstract class Uri {
  public static Uri parse(String uriString) { throw new RuntimeException("Stub!"); }
  public abstract String getHost();
  public abstract String getScheme();
}
