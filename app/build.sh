#!/bin/bash
# Builds and signs ImageGuesser.apk without Gradle: aapt2 + javac + d8 + zipalign + apksigner.
#
# Needs a JDK 17 and an Android SDK with build-tools 34 + platform android-34.
#   export JAVA_HOME=/path/to/jdk-17
#   export ANDROID_SDK_ROOT=/path/to/android-sdk
# (app/setup-toolchain.sh downloads a portable copy of both.)
set -e
# The sandbox caps virtual memory, which the JVM dislikes; keep heaps small.
ulimit -v unlimited 2>/dev/null || true
export JAVA_OPTS="-Xmx512m -XX:MaxMetaspaceSize=192m -XX:-UseCompressedClassPointers -Xss1m ${JAVA_OPTS:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app"
SDK="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
BT="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"
AJ="$(ls "$SDK"/platforms/android-*/android.jar 2>/dev/null | sort -V | tail -1)"
JAVAC="${JAVA_HOME:+$JAVA_HOME/bin/}javac"
KEYTOOL="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"

[ -x "$BT/aapt2" ] || { echo "Android SDK not found — set ANDROID_SDK_ROOT"; exit 1; }
[ -f "$AJ" ] || { echo "platform android-34 not found"; exit 1; }

OUT="$ROOT/out"
rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/dex" "$OUT/assets"
cp "$ROOT/index.html" "$OUT/assets/index.html"

echo "== compile resources =="
"$BT/aapt2" compile --dir "$APP/res" -o "$OUT/res.zip"

echo "== link =="
"$BT/aapt2" link -o "$OUT/base.apk" -I "$AJ" --manifest "$APP/AndroidManifest.xml" \
  -A "$OUT/assets" --java "$OUT/gen" --min-sdk-version 24 --target-sdk-version 34 "$OUT/res.zip"

echo "== javac =="
"$JAVAC" -nowarn -source 8 -target 8 -bootclasspath "$AJ" -d "$OUT/classes" \
  "$APP/src/com/imageguesser/app/MainActivity.java" "$OUT/gen/com/imageguesser/app/R.java" 2>&1 \
  | grep -v "bootstrap class path\|source value 8\|target value 8\|deprecat\|^Note\|warning" || true

echo "== dex =="
"$BT/d8" --release --min-api 24 --lib "$AJ" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

echo "== package =="
mkdir -p "$OUT/stage" && cp "$OUT/dex/classes.dex" "$OUT/stage/classes.dex"
( cd "$OUT/stage" && zip -q -u ../base.apk classes.dex )

echo "== align + sign =="
KS="$APP/keystore.jks"
if [ ! -f "$KS" ]; then
  "$KEYTOOL" -genkeypair -keystore "$KS" -alias imageguesser -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass imageguesser -keypass imageguesser \
    -dname "CN=Image Guesser, OU=Mobile, O=Image Guesser, L=Pune, S=Maharashtra, C=IN"
fi
"$BT/zipalign" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:imageguesser --key-pass pass:imageguesser \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT/ImageGuesser.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT/ImageGuesser.apk" | head -3
ls -lh "$OUT/ImageGuesser.apk"
echo "BUILD OK"
