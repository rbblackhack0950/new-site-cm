package android.webkit;
public abstract class PermissionRequest {
  public static final String RESOURCE_PROTECTED_MEDIA_ID = "android.webkit.resource.PROTECTED_MEDIA_ID";
  public abstract String[] getResources();
  public abstract void grant(String[] resources);
  public abstract void deny();
}
