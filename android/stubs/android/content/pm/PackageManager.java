package android.content.pm;
public abstract class PackageManager {
  public static final int PERMISSION_GRANTED = 0;
  public abstract PackageInfo getPackageInfo(String packageName, int flags) throws NameNotFoundException;
  public abstract PackageInstaller getPackageInstaller();
  public static class NameNotFoundException extends Exception {}
}
