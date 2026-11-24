#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_SDK_ROOT:?Android SDK root required}"
: "${JAVA_HOME:?JDK 21 home required}"
tools="$ANDROID_SDK_ROOT/build-tools/36.0.0"
android="$ANDROID_SDK_ROOT/platforms/android-36/android.jar"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
mkdir -p "$temp"/{classes,dex,assets} builds
cp builds/Harf-Atolyesi-Standalone.html "$temp/assets/index.html"
printf '%s\n' "${GAME_URL:-}" > "$temp/assets/game-url.txt"
"$tools/aapt2" compile --dir mobile/android/res -o "$temp/resources.zip"
"$tools/aapt2" link -I "$android" --manifest mobile/android/AndroidManifest.xml -A "$temp/assets" -o "$temp/unsigned.apk" "$temp/resources.zip"
"$JAVA_HOME/bin/javac" --release 8 -classpath "$android" -d "$temp/classes" mobile/android/src/GameActivity.java
JAVA_HOME="$JAVA_HOME" PATH="$JAVA_HOME/bin:$PATH" "$tools/d8" --min-api 26 --lib "$android" --output "$temp/dex" "$temp/classes/com/harfatolyesi/game/GameActivity.class"
(cd "$temp/dex" && zip -q "$temp/unsigned.apk" classes.dex)
"$tools/zipalign" -f 4 "$temp/unsigned.apk" "$temp/aligned.apk"
key="${TEST_KEYSTORE:-$temp/test-key.jks}"
if [[ ! -f "$key" ]]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$key" -storepass android -keypass android -alias localtest -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Harf Atolyesi Local Test'
fi
"$tools/apksigner" sign --ks "$key" --ks-key-alias localtest --ks-pass pass:android --key-pass pass:android --v4-signing-enabled false --out builds/Harf-Atolyesi-Android-Test.apk "$temp/aligned.apk"
"$tools/apksigner" verify --verbose builds/Harf-Atolyesi-Android-Test.apk
cp builds/Harf-Atolyesi-Android-Test.apk builds/Harf-Atolyesi-Huawei-Test.apk
