#!/bin/bash
# Downloads a portable JDK 17 + Android build-tools 34 + platform 34 so the APK can be
# rebuilt from a clean machine. Idempotent.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .toolchain && cd .toolchain
if [ -x jdk/bin/java ] && [ -d sdk/build-tools ] && [ -d sdk/platforms ]; then
  echo "toolchain already present in $ROOT/.toolchain"; exit 0
fi
echo "downloading JDK 17 (Temurin)…"
curl -sL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o jdk.tar.gz
mkdir -p jdk && tar -xzf jdk.tar.gz -C jdk --strip-components=1 && rm jdk.tar.gz
echo "downloading build-tools 34 and platform android-34…"
curl -sL https://dl.google.com/android/repository/build-tools_r34-linux.zip -o bt.zip
curl -sL https://dl.google.com/android/repository/platform-34-ext7_r03.zip -o plat.zip
mkdir -p sdk && unzip -q -o bt.zip -d sdk && unzip -q -o plat.zip -d sdk && rm bt.zip plat.zip
echo "ready: export JAVA_HOME=$ROOT/.toolchain/jdk ANDROID_SDK_ROOT=$ROOT/.toolchain/sdk"
