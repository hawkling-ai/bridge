#!/bin/bash
set -euxo pipefail

echo "Building Swift audio recorder binary..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "Warning: Swift binary can only be built on macOS"
  echo "Skipping Swift compilation on $OSTYPE"
  exit 0
fi

# Check if swiftc exists
if ! command -v swiftc &> /dev/null; then
  echo "Error: swiftc not found. Install Xcode Command Line Tools:"
  echo "  xcode-select --install"
  exit 1
fi

# Compile Swift binary
SWIFT_SOURCE="src/native/swift/AudioRecorder.swift"
SWIFT_OUTPUT="src/native/swift/AudioRecorder"

if [ ! -f "$SWIFT_SOURCE" ]; then
  echo "Error: Swift source not found at $SWIFT_SOURCE"
  exit 1
fi

echo "Compiling: $SWIFT_SOURCE → $SWIFT_OUTPUT"

swiftc \
  -o "$SWIFT_OUTPUT" \
  "$SWIFT_SOURCE" \
  -O \
  -whole-module-optimization \
  -framework ScreenCaptureKit \
  -framework AVFoundation \
  -framework CoreMedia \
  -framework Foundation

# Verify binary was created
if [ -f "$SWIFT_OUTPUT" ]; then
  echo "✅ Swift binary built successfully"
  echo "   Output: $SWIFT_OUTPUT"
  chmod +x "$SWIFT_OUTPUT"

  # Show binary info
  file "$SWIFT_OUTPUT"
else
  echo "❌ Failed to build Swift binary"
  exit 1
fi
