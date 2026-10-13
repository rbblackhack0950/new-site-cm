#!/usr/bin/env bash
# Builds car-screen.apk without the Android SDK or Gradle (no GitHub Actions needed).
#   aapt2  - from the npm package aaptjs3 (bundles Google's aapt2 binary)
#   d8     - Google's r8lib.jar
#   signer - npm package apk_sign_ts (APK signature v1 + v2 + v3)
#   android.jar - replaced by stubs/ (compile only) and a tiny "framework" resource table built
#                 from the attribute IDs the manifest needs (taken from the real public.xml)
# Usage: android/build-apk.sh [versionCode]   ->  dist/car-screen.apk
set -euo pipefail
cd "$(dirname "$0")"
HERE=$(pwd)
# each build must have a higher versionCode than the published one, or Android refuses the update
PREV=$(python3 -c "import json;print(json.load(open('../dist/version.json'))['versionCode'])" 2>/dev/null || echo 0)
VC=${1:-$((PREV + 1))}
TOOLS=$HERE/.tools
OUT=$HERE/../dist
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
mkdir -p "$TOOLS" "$OUT"

# ---------- tools ----------
if [ ! -x "$TOOLS/aapt2" ]; then
  (cd "$W" && npm pack aaptjs3@2.0.2 >/dev/null && tar xzf aaptjs3-2.0.2.tgz package/bin/x64/linux/aapt2)
  mv "$W/package/bin/x64/linux/aapt2" "$TOOLS/aapt2" && chmod +x "$TOOLS/aapt2"
fi
[ -f "$TOOLS/r8lib.jar" ] || curl -sSfo "$TOOLS/r8lib.jar" https://storage.googleapis.com/r8-releases/raw/8.5.35/r8lib.jar
[ -d "$TOOLS/signer/node_modules/apk_sign_ts" ] || (mkdir -p "$TOOLS/signer" && cd "$TOOLS/signer" && npm init -y >/dev/null && npm install --silent apk_sign_ts@1.0.1)
AAPT2=$TOOLS/aapt2

# ---------- framework resource table (attribute IDs from frameworks/base/core/res/res/values/public.xml) ----------
mkdir -p "$W/fw/res/values"
cat > "$W/fw/AndroidManifest.xml" <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="android"/>
XML
cat > "$W/fw/res/values/attrs.xml" <<'XML'
<resources>
  <attr name="label" format="reference|string"/>
  <attr name="icon" format="reference"/>
  <attr name="name" format="string"/>
  <attr name="exported" format="boolean"/>
  <attr name="launchMode">
    <enum name="standard" value="0"/><enum name="singleTop" value="1"/>
    <enum name="singleTask" value="2"/><enum name="singleInstance" value="3"/>
  </attr>
  <attr name="configChanges">
    <flag name="mcc" value="0x0001"/><flag name="mnc" value="0x0002"/><flag name="locale" value="0x0004"/>
    <flag name="touchscreen" value="0x0008"/><flag name="keyboard" value="0x0010"/><flag name="keyboardHidden" value="0x0020"/>
    <flag name="navigation" value="0x0040"/><flag name="orientation" value="0x0080"/><flag name="screenLayout" value="0x0100"/>
    <flag name="uiMode" value="0x0200"/><flag name="screenSize" value="0x0400"/><flag name="smallestScreenSize" value="0x0800"/>
    <flag name="density" value="0x1000"/><flag name="layoutDirection" value="0x2000"/>
  </attr>
  <attr name="windowSoftInputMode">
    <flag name="adjustUnspecified" value="0x00"/><flag name="adjustResize" value="0x10"/>
    <flag name="adjustPan" value="0x20"/><flag name="adjustNothing" value="0x30"/>
  </attr>
  <attr name="minSdkVersion" format="integer|string"/>
  <attr name="targetSdkVersion" format="integer|string"/>
  <attr name="versionCode" format="integer"/>
  <attr name="versionName" format="string"/>
  <public type="attr" name="label" id="0x01010001"/>
  <public type="attr" name="icon" id="0x01010002"/>
  <public type="attr" name="name" id="0x01010003"/>
  <public type="attr" name="exported" id="0x01010010"/>
  <public type="attr" name="launchMode" id="0x0101001d"/>
  <public type="attr" name="configChanges" id="0x0101001f"/>
  <public type="attr" name="minSdkVersion" id="0x0101020c"/>
  <public type="attr" name="versionCode" id="0x0101021b"/>
  <public type="attr" name="versionName" id="0x0101021c"/>
  <public type="attr" name="windowSoftInputMode" id="0x0101022b"/>
  <public type="attr" name="targetSdkVersion" id="0x01010270"/>
</resources>
XML
"$AAPT2" compile --dir "$W/fw/res" -o "$W/fw.zip"
"$AAPT2" link -x --manifest "$W/fw/AndroidManifest.xml" "$W/fw.zip" -o "$W/framework.apk"

# ---------- app resources + manifest ----------
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android">#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="io.github.rbblackhack0950.carscreen">#' \
  app/src/main/AndroidManifest.xml > "$W/AndroidManifest.xml"
"$AAPT2" compile --dir app/src/main/res -o "$W/res.zip"
"$AAPT2" link -I "$W/framework.apk" --manifest "$W/AndroidManifest.xml" "$W/res.zip" \
  --min-sdk-version 26 --target-sdk-version 34 --version-code "$VC" --version-name "1.0.$VC" \
  -o "$W/res.apk"

# ---------- code ----------
mkdir -p "$W/stubcls" "$W/cls" "$W/dex"
javac --release 8 -nowarn -Xlint:-options -d "$W/stubcls" $(find stubs -name '*.java')
javac --release 8 -Xlint:-options -cp "$W/stubcls" -d "$W/cls" $(find app/src/main/java -name '*.java')
(cd "$W/stubcls" && jar cf "$W/stubs.jar" .)
java -cp "$TOOLS/r8lib.jar" com.android.tools.r8.D8 --release --min-api 26 --lib "$W/stubs.jar" \
  --output "$W/dex" $(find "$W/cls" -name '*.class') 2>&1 | grep -v -e '^Warning' -e 'JAVA_TOOL_OPTIONS' || true
[ -f "$W/dex/classes.dex" ] || { echo "d8 produced no classes.dex" >&2; exit 1; }

# ---------- package: resources.arsc stored + 4-byte aligned (required for targetSdk 30+) ----------
python3 - "$W/res.apk" "$W/dex/classes.dex" "$W/unsigned.apk" <<'PY'
import sys, zipfile
src, dex, out = sys.argv[1:]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, 'w') as zout:
    items = [(i.filename, zin.read(i.filename)) for i in zin.infolist()] + [('classes.dex', open(dex, 'rb').read())]
    for name, data in items:
        stored = name == 'resources.arsc' or name.endswith('.png')
        zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
        if stored:  # pad the local header's extra field so the data starts on a 4-byte boundary
            hdr = 30 + len(name.encode())
            pad = (4 - (zout.fp.tell() + hdr) % 4) % 4
            zi.extra = b'\0' * pad
        zout.writestr(zi, data)
PY

# ---------- sign ----------
openssl pkcs12 -in carscreen.keystore -passin pass:carscreen -nodes -nocerts 2>/dev/null | openssl pkey -out "$W/key.pem"
openssl pkcs12 -in carscreen.keystore -passin pass:carscreen -nokeys -clcerts 2>/dev/null | openssl x509 -out "$W/cert.pem"
cat > "$W/sign.mjs" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const [, , signerDir, inApk, key, cert, outApk] = process.argv;
const { ApkSigner, SigningKey } = await import(signerDir + '/node_modules/apk_sign_ts/dist/index.js');
const signer = new ApkSigner({ signingKey: SigningKey.fromPEM(readFileSync(key, 'utf8'), readFileSync(cert, 'utf8')), digestAlgorithm: 'SHA-256' });
const { signedApk } = await signer.sign(new Uint8Array(readFileSync(inApk)));
writeFileSync(outApk, signedApk);
JS
node "$W/sign.mjs" "$TOOLS/signer" "$W/unsigned.apk" "$W/key.pem" "$W/cert.pem" "$OUT/car-screen.apk"
# what the app compares against to offer an update
cat > "$OUT/version.json" <<JSON
{
  "versionCode": $VC,
  "versionName": "1.0.$VC",
  "url": "dist/car-screen.apk",
  "size": $(wc -c < "$OUT/car-screen.apk"),
  "sha256": "$(sha256sum "$OUT/car-screen.apk" | cut -d' ' -f1)"
}
JSON
echo "built $OUT/car-screen.apk (versionCode $VC, $(wc -c < "$OUT/car-screen.apk") bytes)"
