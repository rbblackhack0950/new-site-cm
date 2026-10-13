Minimal compile-only stand-ins for the few Android SDK classes MainActivity uses, so the APK can be
built without downloading the Android SDK (see ../build-apk.sh). Signatures and constant values
match the real android.jar; the bodies never run, because the device supplies the real classes.
