package android.content.pm;
public class PackageInstaller {
  public static final String EXTRA_STATUS = "android.content.pm.extra.STATUS";
  public static final String EXTRA_STATUS_MESSAGE = "android.content.pm.extra.STATUS_MESSAGE";
  public static final int STATUS_PENDING_USER_ACTION = -1;
  public static final int STATUS_SUCCESS = 0;
  public int createSession(SessionParams params) throws java.io.IOException { throw new RuntimeException("Stub!"); }
  public Session openSession(int sessionId) throws java.io.IOException { throw new RuntimeException("Stub!"); }
  public static class SessionParams {
    public static final int MODE_FULL_INSTALL = 1;
    public SessionParams(int mode) { throw new RuntimeException("Stub!"); }
  }
  public static class Session implements java.io.Closeable {
    public java.io.OutputStream openWrite(String name, long offsetBytes, long lengthBytes) throws java.io.IOException { throw new RuntimeException("Stub!"); }
    public void fsync(java.io.OutputStream out) throws java.io.IOException { throw new RuntimeException("Stub!"); }
    public void commit(android.content.IntentSender statusReceiver) { throw new RuntimeException("Stub!"); }
    public void close() { throw new RuntimeException("Stub!"); }
    public void abandon() { throw new RuntimeException("Stub!"); }
  }
}
