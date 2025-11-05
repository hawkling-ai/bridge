# macOS System Audio Recording Module

This directory contains the native module implementation for capturing system audio on macOS using ScreenCaptureKit.

## Status

⚠️ **Phase 3 - Not Yet Implemented**

This is a placeholder for future implementation. The module will be built in Phase 3 of the project.

## Overview

This native Expo module will provide system audio recording capabilities on macOS by leveraging Apple's ScreenCaptureKit framework (macOS 12.3+).

### Capabilities

- Capture audio from:
  - Entire display
  - Specific window
  - Specific application
- High-quality audio recording (48kHz, stereo)
- Real-time audio stream
- Permission management

### Limitations

- **macOS only** - ScreenCaptureKit is not available on iOS
- Requires macOS 12.3 or later
- Requires screen recording permission
- Cannot capture from apps with protected content (e.g., Apple Music with DRM)

## Implementation Plan

### Phase 1: Module Setup

1. **Initialize Expo Module**
   ```bash
   cd modules/system-audio-macos
   npx create-expo-module system-audio-macos
   ```

2. **Configure module**
   - Update `expo-module.config.json`
   - Set up Swift targets
   - Configure entitlements

3. **Project structure**
   ```
   system-audio-macos/
   ├── ios/
   │   ├── SystemAudioMacOSModule.swift      # Main module
   │   ├── AudioCaptureSession.swift         # Capture logic
   │   ├── AudioFileWriter.swift             # File writing
   │   ├── PermissionManager.swift           # Permissions
   │   └── SystemAudioMacOS.podspec
   ├── src/
   │   ├── index.ts                          # TypeScript API
   │   └── types.ts                          # Type definitions
   ├── expo-module.config.json
   ├── package.json
   └── README.md
   ```

### Phase 2: Swift Implementation

#### 1. Main Module (SystemAudioMacOSModule.swift)

```swift
import ExpoModulesCore
import ScreenCaptureKit

public class SystemAudioMacOSModule: Module {
  private var captureSession: AudioCaptureSession?

  public func definition() -> ModuleDefinition {
    Name("SystemAudioMacOS")

    // Check if screen recording permission is granted
    AsyncFunction("checkPermission") { () -> Bool in
      return await PermissionManager.checkScreenRecordingPermission()
    }

    // Request user to grant permission (opens System Preferences)
    AsyncFunction("requestPermission") { () -> Bool in
      return await PermissionManager.requestScreenRecordingPermission()
    }

    // Get available capture sources
    AsyncFunction("getAvailableSources") { () -> [[String: Any]] in
      guard let content = try? await SCShareableContent.excludingDesktopWindows(
        false,
        onScreenWindowsOnly: true
      ) else {
        return []
      }

      var sources: [[String: Any]] = []

      // Add displays
      for display in content.displays {
        sources.append([
          "type": "display",
          "id": display.displayID,
          "title": "Display \(display.displayID)"
        ])
      }

      // Add windows
      for window in content.windows {
        sources.append([
          "type": "window",
          "id": window.windowID,
          "title": window.title ?? "Unknown Window",
          "app": window.owningApplication?.applicationName ?? "Unknown"
        ])
      }

      // Add applications
      for app in content.applications {
        sources.append([
          "type": "application",
          "id": app.bundleIdentifier,
          "title": app.applicationName
        ])
      }

      return sources
    }

    // Start capturing system audio
    AsyncFunction("startCapture") { (sourceId: String, sourceType: String, outputPath: String) throws in
      guard await PermissionManager.checkScreenRecordingPermission() else {
        throw PermissionError.notGranted
      }

      let session = try await AudioCaptureSession(
        sourceId: sourceId,
        sourceType: sourceType,
        outputPath: outputPath
      )

      self.captureSession = session
      try await session.start()
    }

    // Stop capturing and finalize file
    AsyncFunction("stopCapture") { () -> String in
      guard let session = self.captureSession else {
        throw CaptureError.notStarted
      }

      let outputPath = try await session.stop()
      self.captureSession = nil
      return outputPath
    }

    // Get current capture status
    Function("getCaptureStatus") { () -> [String: Any] in
      guard let session = self.captureSession else {
        return ["isCapturing": false]
      }

      return [
        "isCapturing": session.isCapturing,
        "duration": session.duration,
        "fileSize": session.fileSize
      ]
    }

    // Event: Capture started
    Events("onCaptureStart", "onCaptureStop", "onCaptureError")
  }
}

enum PermissionError: Error {
  case notGranted
  case systemError
}

enum CaptureError: Error {
  case notStarted
  case alreadyCapturing
  case configurationFailed
}
```

#### 2. Audio Capture Session (AudioCaptureSession.swift)

```swift
import ScreenCaptureKit
import AVFoundation

class AudioCaptureSession: NSObject {
  private var stream: SCStream?
  private var fileWriter: AudioFileWriter?
  private var startTime: Date?

  private(set) var isCapturing = false
  var duration: TimeInterval {
    guard let start = startTime else { return 0 }
    return Date().timeIntervalSince(start)
  }
  var fileSize: Int64 {
    fileWriter?.fileSize ?? 0
  }

  init(sourceId: String, sourceType: String, outputPath: String) async throws {
    super.init()

    // Get shareable content
    let content = try await SCShareableContent.excludingDesktopWindows(
      false,
      onScreenWindowsOnly: true
    )

    // Create content filter based on source type
    let filter: SCContentFilter
    switch sourceType {
    case "display":
      guard let display = content.displays.first(where: {
        $0.displayID == UInt32(sourceId)
      }) else {
        throw CaptureError.configurationFailed
      }
      filter = SCContentFilter(display: display, excludingWindows: [])

    case "window":
      guard let window = content.windows.first(where: {
        String($0.windowID) == sourceId
      }) else {
        throw CaptureError.configurationFailed
      }
      filter = SCContentFilter(desktopIndependentWindow: window)

    case "application":
      guard let app = content.applications.first(where: {
        $0.bundleIdentifier == sourceId
      }) else {
        throw CaptureError.configurationFailed
      }
      filter = SCContentFilter(
        display: content.displays.first!,
        including: [app],
        exceptingWindows: []
      )

    default:
      throw CaptureError.configurationFailed
    }

    // Configure stream for audio only
    let config = SCStreamConfiguration()
    config.capturesAudio = true
    config.sampleRate = 48000
    config.channelCount = 2
    config.excludesCurrentProcessAudio = true

    // Create stream
    stream = SCStream(filter: filter, configuration: config, delegate: self)

    // Create file writer
    fileWriter = try AudioFileWriter(outputPath: outputPath)
  }

  func start() async throws {
    guard let stream = stream else {
      throw CaptureError.configurationFailed
    }

    try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global())
    try await stream.startCapture()

    isCapturing = true
    startTime = Date()
  }

  func stop() async throws -> String {
    guard let stream = stream else {
      throw CaptureError.notStarted
    }

    try await stream.stopCapture()
    isCapturing = false

    guard let outputPath = fileWriter?.finalize() else {
      throw CaptureError.configurationFailed
    }

    return outputPath
  }
}

// MARK: - SCStreamOutput
extension AudioCaptureSession: SCStreamOutput {
  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of type: SCStreamOutputType
  ) {
    guard type == .audio else { return }

    do {
      try fileWriter?.append(sampleBuffer)
    } catch {
      print("Error writing audio sample: \(error)")
    }
  }
}

// MARK: - SCStreamDelegate
extension AudioCaptureSession: SCStreamDelegate {
  func stream(_ stream: SCStream, didStopWithError error: Error) {
    print("Stream stopped with error: \(error)")
    isCapturing = false
  }
}
```

#### 3. Audio File Writer (AudioFileWriter.swift)

```swift
import AVFoundation

class AudioFileWriter {
  private var assetWriter: AVAssetWriter?
  private var assetWriterInput: AVAssetWriterInput?
  private let outputURL: URL

  var fileSize: Int64 {
    (try? FileManager.default.attributesOfItem(atPath: outputURL.path)[.size] as? Int64) ?? 0
  }

  init(outputPath: String) throws {
    self.outputURL = URL(fileURLWithPath: outputPath)

    // Create asset writer
    assetWriter = try AVAssetWriter(url: outputURL, fileType: .m4a)

    // Configure audio input
    let audioSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 48000,
      AVNumberOfChannelsKey: 2,
      AVEncoderBitRateKey: 192000
    ]

    assetWriterInput = AVAssetWriterInput(
      mediaType: .audio,
      outputSettings: audioSettings
    )
    assetWriterInput?.expectsMediaDataInRealTime = true

    if let input = assetWriterInput {
      assetWriter?.add(input)
    }

    assetWriter?.startWriting()
    assetWriter?.startSession(atSourceTime: .zero)
  }

  func append(_ sampleBuffer: CMSampleBuffer) throws {
    guard let input = assetWriterInput,
          input.isReadyForMoreMediaData else {
      return
    }

    if !input.append(sampleBuffer) {
      throw WriterError.appendFailed
    }
  }

  func finalize() -> String? {
    assetWriterInput?.markAsFinished()
    assetWriter?.finishWriting { [weak self] in
      print("Audio file finalized: \(self?.outputURL.path ?? "")")
    }

    return outputURL.path
  }
}

enum WriterError: Error {
  case initializationFailed
  case appendFailed
}
```

#### 4. Permission Manager (PermissionManager.swift)

```swift
import ScreenCaptureKit
import AppKit

class PermissionManager {
  static func checkScreenRecordingPermission() async -> Bool {
    // On macOS 12.3+, we can check this by attempting to get shareable content
    do {
      _ = try await SCShareableContent.excludingDesktopWindows(
        false,
        onScreenWindowsOnly: true
      )
      return true
    } catch {
      return false
    }
  }

  static func requestScreenRecordingPermission() async -> Bool {
    // There's no programmatic way to request screen recording permission
    // We need to guide the user to System Preferences

    let hasPermission = await checkScreenRecordingPermission()

    if !hasPermission {
      await MainActor.run {
        let alert = NSAlert()
        alert.messageText = "Screen Recording Permission Required"
        alert.informativeText = """
          This app needs Screen Recording permission to capture system audio.

          Please:
          1. Open System Preferences
          2. Go to Privacy & Security → Screen Recording
          3. Enable permission for this app
          4. Restart the app
          """
        alert.addButton(withTitle: "Open System Preferences")
        alert.addButton(withTitle: "Cancel")

        if alert.runModal() == .alertFirstButtonReturn {
          NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")!)
        }
      }
    }

    return hasPermission
  }
}
```

### Phase 3: TypeScript Bridge

#### index.ts

```typescript
import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

const SystemAudioMacOS = NativeModulesProxy.SystemAudioMacOS;

export interface CaptureSource {
  type: 'display' | 'window' | 'application';
  id: string;
  title: string;
  app?: string; // For windows
}

export interface CaptureStatus {
  isCapturing: boolean;
  duration?: number;
  fileSize?: number;
}

export async function checkPermission(): Promise<boolean> {
  return await SystemAudioMacOS.checkPermission();
}

export async function requestPermission(): Promise<boolean> {
  return await SystemAudioMacOS.requestPermission();
}

export async function getAvailableSources(): Promise<CaptureSource[]> {
  return await SystemAudioMacOS.getAvailableSources();
}

export async function startCapture(
  sourceId: string,
  sourceType: CaptureSource['type'],
  outputPath: string
): Promise<void> {
  await SystemAudioMacOS.startCapture(sourceId, sourceType, outputPath);
}

export async function stopCapture(): Promise<string> {
  return await SystemAudioMacOS.stopCapture();
}

export function getCaptureStatus(): CaptureStatus {
  return SystemAudioMacOS.getCaptureStatus();
}

// Events
const emitter = new EventEmitter(SystemAudioMacOS);

export function addCaptureStartListener(
  listener: () => void
): { remove: () => void } {
  return emitter.addListener('onCaptureStart', listener);
}

export function addCaptureStopListener(
  listener: () => void
): { remove: () => void } {
  return emitter.addListener('onCaptureStop', listener);
}

export function addCaptureErrorListener(
  listener: (error: Error) => void
): { remove: () => void } {
  return emitter.addListener('onCaptureError', listener);
}
```

### Phase 4: Usage Example

```typescript
// In your recording hook
import * as SystemAudio from '@/modules/system-audio-macos';
import { Platform } from 'react-native';

export function useSystemAudioRecording() {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'macos') return;

    loadSources();
  }, []);

  const loadSources = async () => {
    const hasPermission = await SystemAudio.checkPermission();

    if (!hasPermission) {
      const granted = await SystemAudio.requestPermission();
      if (!granted) return;
    }

    const availableSources = await SystemAudio.getAvailableSources();
    setSources(availableSources);
  };

  const startRecording = async () => {
    if (!selectedSource) {
      throw new Error('No source selected');
    }

    const outputPath = `${FileSystem.documentDirectory}recordings/system_${Date.now()}.m4a`;

    await SystemAudio.startCapture(
      selectedSource.id,
      selectedSource.type,
      outputPath
    );
  };

  const stopRecording = async () => {
    const filePath = await SystemAudio.stopCapture();
    return filePath;
  };

  return {
    sources,
    selectedSource,
    setSelectedSource,
    startRecording,
    stopRecording,
  };
}
```

## Configuration

### app.json

```json
{
  "expo": {
    "plugins": [
      [
        "./modules/system-audio-macos",
        {
          "screenRecordingPermission": "This app needs screen recording permission to capture system audio."
        }
      ]
    ]
  }
}
```

### eas.json

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

## Testing

### Unit Tests (Jest)
```typescript
describe('SystemAudioMacOS', () => {
  it('should check permissions', async () => {
    const hasPermission = await SystemAudio.checkPermission();
    expect(typeof hasPermission).toBe('boolean');
  });

  it('should list available sources', async () => {
    const sources = await SystemAudio.getAvailableSources();
    expect(Array.isArray(sources)).toBe(true);
  });
});
```

### Manual Testing
1. Run on macOS development build
2. Request permission → verify System Preferences opens
3. Grant permission
4. List sources → verify displays/windows/apps appear
5. Start capture → verify recording begins
6. Stop capture → verify file is created
7. Play file → verify audio is captured correctly

## Resources

- [ScreenCaptureKit Documentation](https://developer.apple.com/documentation/screencapturekit)
- [Expo Modules API](https://docs.expo.dev/modules/overview/)
- [Apple Sample Code: CaptureSample](https://developer.apple.com/documentation/screencapturekit/capturing_screen_content_in_macos)

## Timeline Estimate

- **Module Setup**: 1-2 days
- **Swift Implementation**: 5-7 days
- **TypeScript Bridge**: 1-2 days
- **Testing & Debugging**: 3-5 days
- **Documentation**: 1-2 days

**Total**: 2-3 weeks

## Next Steps

1. Review this implementation plan
2. Set up development environment with Xcode
3. Create Expo module structure
4. Implement Swift code incrementally
5. Test each component thoroughly
6. Integrate with main app
7. Document usage and limitations

---

**Status**: Planning Complete - Ready for Implementation
**Target**: Phase 3
**Last Updated**: 2025-01-05
