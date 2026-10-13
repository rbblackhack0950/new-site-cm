package android.app;
public final class PendingIntent {
  public static final int FLAG_UPDATE_CURRENT = 0x08000000;
  public static final int FLAG_MUTABLE = 0x02000000;
  public static PendingIntent getActivity(android.content.Context context, int requestCode, android.content.Intent intent, int flags) { throw new RuntimeException("Stub!"); }
  public android.content.IntentSender getIntentSender() { throw new RuntimeException("Stub!"); }
}
