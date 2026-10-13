package android.webkit;
public abstract class WebSettings {
  public abstract void setJavaScriptEnabled(boolean flag);
  public abstract void setDomStorageEnabled(boolean flag);
  public abstract void setDatabaseEnabled(boolean flag);
  public abstract void setMediaPlaybackRequiresUserGesture(boolean require);
  public abstract void setSupportMultipleWindows(boolean support);
  public abstract void setLoadWithOverviewMode(boolean overview);
  public abstract void setUseWideViewPort(boolean use);
  public abstract void setGeolocationEnabled(boolean flag);
  public abstract String getUserAgentString();
  public abstract void setUserAgentString(String ua);
}
