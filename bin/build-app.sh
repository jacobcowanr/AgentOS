#!/usr/bin/env bash
# build-app.sh — (re)build /Applications/AgentOS.app: a launcher that runs `agentos` (starts the server + opens the window)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-/Applications/AgentOS.app}"
rm -rf "$APP"
osacompile -o "$APP" "$ROOT/AgentOS.applescript"
cp "$ROOT/assets/AgentOS.icns" "$APP/Contents/Resources/applet.icns"
rm -f "$APP/Contents/Resources/Assets.car"
PL="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.jacobcowan.agentos" "$PL" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.jacobcowan.agentos" "$PL"
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string AgentOS" "$PL" 2>/dev/null || true
codesign --force --deep -s - "$APP"
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
echo "Built $APP"
