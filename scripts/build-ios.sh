#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
platform="${1:-iphoneos}"
case "$platform" in
  iphoneos) target=arm64-apple-ios16.0; name=iPhoneOS ;;
  iphonesimulator) target="$(uname -m)-apple-ios16.0-simulator"; name=iPhoneSimulator ;;
  *) exit 2 ;;
esac
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
app="$temp/Payload/HarfAtolyesi.app"
mkdir -p "$app" builds
sdk="$(xcrun --sdk "$platform" --show-sdk-path)"
xcrun --sdk "$platform" swiftc -sdk "$sdk" -target "$target" -module-cache-path "$temp/cache" -parse-as-library -O mobile/ios/HarfAtolyesi.swift -o "$app/HarfAtolyesi"
cp mobile/ios/{Info.plist,AppIcon*.png} "$app/"
cp builds/Harf-Atolyesi-Standalone.html "$app/index.html"
printf '%s\n' "${GAME_URL:-}" > "$app/game-url.txt"
/usr/libexec/PlistBuddy -c "Set :CFBundleSupportedPlatforms:0 $name" "$app/Info.plist"
if [[ "$platform" == iphoneos ]]; then
  codesign --remove-signature "$app/HarfAtolyesi"
  output="$PWD/builds/Harf-Atolyesi-iOS-Unsigned.ipa"
  (cd "$temp" && zip -qr "$output" Payload)
else
  codesign --force --sign - "$app"
  output="$PWD/builds/Harf-Atolyesi-iOS-Simulator.zip"
  (cd "$temp/Payload" && zip -qr "$output" HarfAtolyesi.app)
fi
unzip -tq "$output"
