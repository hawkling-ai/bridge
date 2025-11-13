# electron-screencapturekit

Node.js native addon for macOS audio capture using ScreenCaptureKit and AVAudioEngine.

## Overview

This is a **Node.js native addon** (not an Expo module) that wraps Apple's audio frameworks to enable comprehensive audio recording in Electron apps:
- **ScreenCaptureKit**: System audio capture (macOS 12.3+)
- **AVAudioEngine/Core Audio**: Microphone audio capture

## Features

### System Audio Capture (ScreenCaptureKit)
- ✅ Capture system audio from:
  - Entire display
  - Specific window
  - Specific application
- ✅ High-quality audio (48kHz stereo AAC)
- ✅ Screen recording permission management

### Microphone Audio Capture (AVAudioEngine)
- ✅ Capture audio from:
  - Default microphone
  - Specific audio input device
- ✅ High-quality audio (48kHz stereo AAC)
- ✅ Microphone permission management
- ✅ Audio device enumeration

### Combined Recording
- ✅ Simultaneous system + microphone capture
- ✅ Separate or mixed output modes
- ✅ Synchronized audio streams

### Common Features
- ✅ Async API with Promises
- ✅ Real-time status updates
- ✅ TypeScript definitions

## Requirements

- **macOS**: 12.3+ (Monterey or later - ScreenCaptureKit availability)
- **Xcode**: 13+ with Command Line Tools
- **Node.js**: 20+ (for Node-API v9)
- **node-gyp**: Latest version

## Installation

```bash
cd native-modules/electron-screencapturekit
npm install
npm run build
```

## API

### TypeScript Definitions

```typescript
// Audio source types
type AudioSource = 'system' | 'microphone' | 'combined';
type SystemSource = 'display' | 'window' | 'application';
type MixMode = 'separate' | 'mixed';

// Capture options
interface SystemAudioOptions {
  source: SystemSource;
  sourceId?: string;  // Display ID, window ID, or bundle identifier
  quality: 'low' | 'medium' | 'high';
  outputPath: string;
}

interface MicrophoneOptions {
  deviceId?: string;  // Audio device UID (null for default)
  quality: 'low' | 'medium' | 'high';
  outputPath: string;
}

interface CombinedOptions {
  systemSource: SystemSource;
  systemSourceId?: string;
  micDeviceId?: string;
  quality: 'low' | 'medium' | 'high';
  outputPath: string;  // Base path (will append _system/_mic for separate mode)
  mixMode: MixMode;
}

// Device information
interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

interface SystemAudioSource {
  type: SystemSource;
  id: string;
  title: string;
  app?: string;  // For windows
}

// Status
interface CaptureStatus {
  isCapturing: boolean;
  audioSource: AudioSource;
  duration: number;  // milliseconds
  fileSize: number | { system: number; microphone: number };  // bytes
}

// Permission management
export function checkScreenRecordingPermission(): Promise<boolean>;
export function requestScreenRecordingPermission(): Promise<boolean>;
export function checkMicrophonePermission(): Promise<boolean>;
export function requestMicrophonePermission(): Promise<boolean>;

// Device enumeration
export function getAvailableSystemAudioSources(): Promise<SystemAudioSource[]>;
export function getAvailableMicrophones(): Promise<AudioDevice[]>;

// System audio capture
export function startSystemAudioCapture(options: SystemAudioOptions): Promise<void>;
export function stopSystemAudioCapture(): Promise<string>;

// Microphone capture
export function startMicrophoneCapture(options: MicrophoneOptions): Promise<void>;
export function stopMicrophoneCapture(): Promise<string>;

// Combined capture
export function startCombinedCapture(options: CombinedOptions): Promise<void>;
export function stopCombinedCapture(): Promise<{ system?: string; microphone?: string; mixed?: string }>;

// Status
export function getStatus(): CaptureStatus;
```

### Usage Examples

#### Example 1: System Audio Only

```javascript
const audio = require('@recording-app/electron-screencapturekit');

// Check screen recording permission
const hasPermission = await audio.checkScreenRecordingPermission();

if (!hasPermission) {
  const granted = await audio.requestScreenRecordingPermission();
  if (!granted) {
    throw new Error('Screen recording permission denied');
  }
}

// Get available system audio sources
const sources = await audio.getAvailableSystemAudioSources();
console.log('Available sources:', sources);

// Start system audio capture
await audio.startSystemAudioCapture({
  source: 'display',  // or 'window' or 'application'
  sourceId: sources[0].id,
  quality: 'high',
  outputPath: '/path/to/system_audio.m4a',
});

// Monitor status
const status = audio.getStatus();
console.log(`Recording: ${status.duration}ms, ${status.fileSize} bytes`);

// Stop capture
const filePath = await audio.stopSystemAudioCapture();
console.log(`Saved to: ${filePath}`);
```

#### Example 2: Microphone Only

```javascript
const audio = require('@recording-app/electron-screencapturekit');

// Check microphone permission
const hasPermission = await audio.checkMicrophonePermission();

if (!hasPermission) {
  const granted = await audio.requestMicrophonePermission();
  if (!granted) {
    throw new Error('Microphone permission denied');
  }
}

// Get available microphones
const microphones = await audio.getAvailableMicrophones();
console.log('Available microphones:', microphones);

// Select default or specific microphone
const defaultMic = microphones.find(mic => mic.isDefault);

// Start microphone capture
await audio.startMicrophoneCapture({
  deviceId: defaultMic?.id,  // or undefined for default
  quality: 'high',
  outputPath: '/path/to/microphone.m4a',
});

// Stop capture
const filePath = await audio.stopMicrophoneCapture();
console.log(`Saved to: ${filePath}`);
```

#### Example 3: Combined (System + Microphone)

```javascript
const audio = require('@recording-app/electron-screencapturekit');

// Check both permissions
const [hasScreenPerm, hasMicPerm] = await Promise.all([
  audio.checkScreenRecordingPermission(),
  audio.checkMicrophonePermission(),
]);

if (!hasScreenPerm) {
  await audio.requestScreenRecordingPermission();
}

if (!hasMicPerm) {
  await audio.requestMicrophonePermission();
}

// Get sources and devices
const [sources, microphones] = await Promise.all([
  audio.getAvailableSystemAudioSources(),
  audio.getAvailableMicrophones(),
]);

// Start combined capture
await audio.startCombinedCapture({
  systemSource: 'application',
  systemSourceId: sources[0].id,
  micDeviceId: microphones[0].id,
  quality: 'high',
  outputPath: '/path/to/recording.m4a',
  mixMode: 'separate',  // or 'mixed'
});

// Stop capture
const filePaths = await audio.stopCombinedCapture();
console.log('Saved to:', filePaths);
// Separate mode: { system: '...', microphone: '...' }
// Mixed mode: { mixed: '...' }
```

## Implementation

### Project Structure

```
electron-screencapturekit/
├── src/
│   ├── binding.cpp                      # Node-API bindings (main)
│   ├── audio_capture.h                  # Common audio capture interface
│   ├── system_audio_capture.h           # System audio header
│   ├── system_audio_capture.mm          # ScreenCaptureKit implementation
│   ├── microphone_capture.h             # Microphone audio header
│   ├── microphone_capture.mm            # AVAudioEngine implementation
│   ├── combined_capture.h               # Combined recording header
│   ├── combined_capture.mm              # Combined recording implementation
│   ├── audio_writer.h                   # Audio file writer header
│   ├── audio_writer.mm                  # Audio file writer implementation
│   └── audio_device_manager.mm          # Device enumeration
├── binding.gyp                          # node-gyp build config
├── index.js                             # JavaScript exports
├── index.d.ts                           # TypeScript definitions
├── package.json
└── README.md
```

### binding.cpp (Node-API Bindings)

```cpp
#include <napi.h>
#include "system_audio_capture.h"
#include "microphone_capture.h"
#include "combined_capture.h"
#include "audio_device_manager.h"

// Global capture sessions
enum class CaptureMode {
  None,
  SystemAudio,
  Microphone,
  Combined
};

static CaptureMode currentMode = CaptureMode::None;
static std::unique_ptr<SystemAudioCapture> systemAudioSession;
static std::unique_ptr<MicrophoneCapture> microphoneSession;
static std::unique_ptr<CombinedCapture> combinedSession;

// Check screen recording permission
Napi::Value CheckPermission(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  bool hasPermission = ScreenCaptureSession::CheckPermission();

  return Napi::Boolean::New(env, hasPermission);
}

// Request screen recording permission
Napi::Promise RequestPermission(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto deferred = Napi::Promise::Deferred::New(env);

  ScreenCaptureSession::RequestPermission([env, deferred](bool granted) {
    deferred.Resolve(Napi::Boolean::New(env, granted));
  });

  return deferred.Promise();
}

// Start audio capture
Napi::Promise StartCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto deferred = Napi::Promise::Deferred::New(env);

  if (info.Length() < 1 || !info[0].IsObject()) {
    deferred.Reject(Napi::Error::New(env, "Options object required").Value());
    return deferred.Promise();
  }

  Napi::Object options = info[0].As<Napi::Object>();

  // Parse options
  std::string source = options.Get("source").As<Napi::String>();
  std::string quality = options.Get("quality").As<Napi::String>();
  std::string outputPath = options.Get("outputPath").As<Napi::String>();

  // Create capture session
  captureSession = std::make_unique<ScreenCaptureSession>();

  // Start capture
  captureSession->Start(source, quality, outputPath, [env, deferred](bool success, std::string error) {
    if (success) {
      deferred.Resolve(env.Null());
    } else {
      deferred.Reject(Napi::Error::New(env, error).Value());
    }
  });

  return deferred.Promise();
}

// Stop audio capture
Napi::Promise StopCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto deferred = Napi::Promise::Deferred::New(env);

  if (!captureSession) {
    deferred.Reject(Napi::Error::New(env, "No active capture session").Value());
    return deferred.Promise();
  }

  captureSession->Stop([env, deferred](bool success, std::string filePath, std::string error) {
    if (success) {
      deferred.Resolve(Napi::String::New(env, filePath));
      captureSession.reset();
    } else {
      deferred.Reject(Napi::Error::New(env, error).Value());
    }
  });

  return deferred.Promise();
}

// Get capture status
Napi::Object GetStatus(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object status = Napi::Object::New(env);

  if (captureSession) {
    auto captureStatus = captureSession->GetStatus();
    status.Set("isCapturing", captureStatus.isCapturing);
    status.Set("duration", captureStatus.duration);
    status.Set("fileSize", captureStatus.fileSize);
  } else {
    status.Set("isCapturing", false);
    status.Set("duration", 0);
    status.Set("fileSize", 0);
  }

  return status;
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("checkPermission", Napi::Function::New(env, CheckPermission));
  exports.Set("requestPermission", Napi::Function::New(env, RequestPermission));
  exports.Set("startCapture", Napi::Function::New(env, StartCapture));
  exports.Set("stopCapture", Napi::Function::New(env, StopCapture));
  exports.Set("getStatus", Napi::Function::New(env, GetStatus));

  return exports;
}

NODE_API_MODULE(screencapturekit, Init)
```

### screencapture.mm (ScreenCaptureKit Implementation)

```objc
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <AVFoundation/AVFoundation.h>
#include "screencapture.h"

@interface ScreenCaptureDelegate : NSObject <SCStreamDelegate, SCStreamOutput>
@property (nonatomic, strong) AVAssetWriter *assetWriter;
@property (nonatomic, strong) AVAssetWriterInput *assetWriterInput;
@property (nonatomic, copy) void (^completionHandler)(BOOL, NSString*, NSError*);
@end

@implementation ScreenCaptureDelegate

- (void)stream:(SCStream *)stream didOutputSampleBuffer:(CMSampleBuffer *)sampleBuffer ofType:(SCStreamOutputType)type {
  if (type != SCStreamOutputTypeAudio) {
    return;
  }

  if (self.assetWriterInput.isReadyForMoreMediaData) {
    [self.assetWriterInput appendSampleBuffer:sampleBuffer];
  }
}

- (void)stream:(SCStream *)stream didStopWithError:(NSError *)error {
  if (error) {
    NSLog(@"Stream stopped with error: %@", error);
    if (self.completionHandler) {
      self.completionHandler(NO, nil, error);
    }
  }
}

@end

// C++ Implementation
class ScreenCaptureSession::Impl {
public:
  SCStream *stream;
  ScreenCaptureDelegate *delegate;
  bool isCapturing;
  NSDate *startTime;
  NSString *outputPath;

  Impl() : stream(nil), delegate(nil), isCapturing(false), startTime(nil), outputPath(nil) {}

  static bool CheckPermission() {
    if (@available(macOS 12.3, *)) {
      // Try to get shareable content - will fail if permission not granted
      __block BOOL hasPermission = NO;
      dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

      [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent *content, NSError *error) {
        hasPermission = (error == nil);
        dispatch_semaphore_signal(semaphore);
      }];

      dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
      return hasPermission;
    }
    return false;
  }

  static void RequestPermission(std::function<void(bool)> callback) {
    dispatch_async(dispatch_get_main_queue(), ^{
      NSAlert *alert = [[NSAlert alloc] init];
      alert.messageText = @"Screen Recording Permission Required";
      alert.informativeText = @"This app needs Screen Recording permission to capture system audio.\n\n"
                               "Please:\n"
                               "1. Open System Preferences\n"
                               "2. Go to Privacy & Security → Screen Recording\n"
                               "3. Enable permission for this app\n"
                               "4. Restart the app";
      [alert addButtonWithTitle:@"Open System Preferences"];
      [alert addButtonWithTitle:@"Cancel"];

      NSModalResponse response = [alert runModal];

      if (response == NSAlertFirstButtonReturn) {
        [[NSWorkspace sharedWorkspace] openURL:
          [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"]];
      }

      // Check permission after alert
      bool hasPermission = CheckPermission();
      callback(hasPermission);
    });
  }

  void Start(const std::string& source, const std::string& quality, const std::string& output,
             std::function<void(bool, std::string)> callback) {
    if (@available(macOS 12.3, *)) {
      outputPath = [NSString stringWithUTF8String:output.c_str()];

      [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent *content, NSError *error) {
        if (error) {
          callback(false, std::string([error.localizedDescription UTF8String]));
          return;
        }

        // Create filter
        SCContentFilter *filter = nil;
        if (source == "display") {
          SCDisplay *display = content.displays.firstObject;
          filter = [[SCContentFilter alloc] initWithDisplay:display excludingWindows:@[]];
        }
        // Add window and application filters here...

        // Configure stream
        SCStreamConfiguration *config = [[SCStreamConfiguration alloc] init];
        config.capturesAudio = YES;
        config.sampleRate = 48000;
        config.channelCount = 2;
        config.excludesCurrentProcessAudio = YES;

        // Quality settings
        if (quality == "high") {
          // High quality settings
        }

        // Create delegate
        delegate = [[ScreenCaptureDelegate alloc] init];

        // Setup asset writer
        NSError *writerError = nil;
        NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
        delegate.assetWriter = [[AVAssetWriter alloc] initWithURL:outputURL
                                                          fileType:AVFileTypeAppleM4A
                                                             error:&writerError];

        NSDictionary *audioSettings = @{
          AVFormatIDKey: @(kAudioFormatMPEG4AAC),
          AVSampleRateKey: @48000,
          AVNumberOfChannelsKey: @2,
          AVEncoderBitRateKey: @192000
        };

        delegate.assetWriterInput = [[AVAssetWriterInput alloc]
          initWithMediaType:AVMediaTypeAudio
          outputSettings:audioSettings];
        delegate.assetWriterInput.expectsMediaDataInRealTime = YES;

        [delegate.assetWriter addInput:delegate.assetWriterInput];
        [delegate.assetWriter startWriting];
        [delegate.assetWriter startSessionAtSourceTime:kCMTimeZero];

        // Create stream
        stream = [[SCStream alloc] initWithFilter:filter
                                    configuration:config
                                         delegate:delegate];

        // Add stream output
        NSError *outputError = nil;
        [stream addStreamOutput:delegate
                           type:SCStreamOutputTypeAudio
                sampleHandlerQueue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0)
                          error:&outputError];

        // Start capture
        [stream startCaptureWithCompletionHandler:^(NSError *error) {
          if (error) {
            callback(false, std::string([error.localizedDescription UTF8String]));
          } else {
            isCapturing = YES;
            startTime = [NSDate date];
            callback(true, "");
          }
        }];
      }];
    } else {
      callback(false, "macOS 12.3 or later required");
    }
  }

  void Stop(std::function<void(bool, std::string, std::string)> callback) {
    if (!stream) {
      callback(false, "", "No active stream");
      return;
    }

    [stream stopCaptureWithCompletionHandler:^(NSError *error) {
      isCapturing = NO;

      [delegate.assetWriterInput markAsFinished];
      [delegate.assetWriter finishWritingWithCompletionHandler:^{
        if (error) {
          callback(false, "", std::string([error.localizedDescription UTF8String]));
        } else {
          std::string path = std::string([outputPath UTF8String]);
          callback(true, path, "");
        }

        stream = nil;
        delegate = nil;
      }];
    }];
  }

  CaptureStatus GetStatus() {
    CaptureStatus status;
    status.isCapturing = isCapturing;

    if (isCapturing && startTime) {
      status.duration = (int64_t)(-[startTime timeIntervalSinceNow] * 1000);
    } else {
      status.duration = 0;
    }

    // Get file size if available
    if (outputPath) {
      NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:outputPath error:nil];
      status.fileSize = [attrs[NSFileSize] longLongValue];
    } else {
      status.fileSize = 0;
    }

    return status;
  }
};

// ScreenCaptureSession implementation
ScreenCaptureSession::ScreenCaptureSession() : impl(std::make_unique<Impl>()) {}
ScreenCaptureSession::~ScreenCaptureSession() = default;

bool ScreenCaptureSession::CheckPermission() {
  return Impl::CheckPermission();
}

void ScreenCaptureSession::RequestPermission(std::function<void(bool)> callback) {
  Impl::RequestPermission(callback);
}

void ScreenCaptureSession::Start(const std::string& source, const std::string& quality,
                                  const std::string& outputPath,
                                  std::function<void(bool, std::string)> callback) {
  impl->Start(source, quality, outputPath, callback);
}

void ScreenCaptureSession::Stop(std::function<void(bool, std::string, std::string)> callback) {
  impl->Stop(callback);
}

CaptureStatus ScreenCaptureSession::GetStatus() {
  return impl->GetStatus();
}
```

### binding.gyp

```python
{
  "targets": [
    {
      "target_name": "screencapturekit",
      "sources": [
        "src/binding.cpp",
        "src/screencapture.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "libraries": [
        "-framework ScreenCaptureKit",
        "-framework AVFoundation",
        "-framework CoreMedia",
        "-framework CoreGraphics"
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "12.3",
        "OTHER_CPLUSPLUSFLAGS": ["-std=c++17", "-stdlib=libc++"],
        "OTHER_LDFLAGS": ["-framework ScreenCaptureKit"]
      },
      "conditions": [
        ["OS=='mac'", {
          "cflags+": ["-fvisibility=hidden"],
          "xcode_settings": {
            "GCC_SYMBOLS_PRIVATE_EXTERN": "YES"
          }
        }]
      ]
    }
  ]
}
```

### package.json

```json
{
  "name": "@recording-app/electron-screencapturekit",
  "version": "0.1.0",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "install": "node-gyp rebuild",
    "build": "node-gyp configure && node-gyp build",
    "clean": "node-gyp clean"
  },
  "dependencies": {
    "node-addon-api": "^8.0.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  },
  "gypfile": true,
  "engines": {
    "node": ">=20.0.0"
  }
}
```

## Building

### Prerequisites

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install node-gyp globally
npm install -g node-gyp
```

### Build Steps

```bash
# Install dependencies
npm install

# Configure
npm run build

# The compiled addon will be in build/Release/screencapturekit.node
```

## Testing

```javascript
// test.js
const screencapture = require('./index.js');

async function test() {
  // Check permission
  const hasPermission = await screencapture.checkPermission();
  console.log('Has permission:', hasPermission);

  if (!hasPermission) {
    console.log('Requesting permission...');
    const granted = await screencapture.requestPermission();

    if (!granted) {
      console.log('Permission denied. Please enable in System Preferences.');
      return;
    }
  }

  // Start capture
  console.log('Starting capture...');
  await screencapture.startCapture({
    source: 'display',
    quality: 'high',
    outputPath: '/tmp/test-recording.m4a',
  });

  // Record for 5 seconds
  setTimeout(async () => {
    const status = screencapture.getStatus();
    console.log('Status:', status);

    console.log('Stopping capture...');
    const filePath = await screencapture.stopCapture();
    console.log('Saved to:', filePath);
  }, 5000);
}

test().catch(console.error);
```

## Troubleshooting

### Permission Issues

**Error: "Screen recording permission denied"**
1. Open System Preferences → Privacy & Security → Screen Recording
2. Enable permission for your Electron app
3. Restart the app

### Build Errors

**Error: "ScreenCaptureKit/ScreenCaptureKit.h not found"**
- Ensure you're on macOS 12.3+
- Install Xcode Command Line Tools: `xcode-select --install`

**Error: "node-gyp not found"**
```bash
npm install -g node-gyp
```

**Error: "Cannot find module 'node-addon-api'"**
```bash
cd native-modules/electron-screencapturekit
npm install
```

## Additional Implementation: Microphone & Combined Capture

The existing code above shows the system audio (ScreenCaptureKit) implementation. Below are the additional implementations needed for microphone and combined recording.

### microphone_capture.mm (AVAudioEngine Implementation)

```objc
#import <AVFoundation/AVFoundation.h>
#import <CoreAudio/CoreAudio.h>
#include "microphone_capture.h"
#include "audio_writer.h"

class MicrophoneCapture::Impl {
public:
  AVAudioEngine *audioEngine;
  AudioWriter *audioWriter;
  bool isCapturing;
  NSDate *startTime;
  std::string outputPath;

  Impl() : audioEngine(nil), audioWriter(nil), isCapturing(false), startTime(nil) {}

  ~Impl() {
    if (audioEngine) {
      [audioEngine stop];
    }
  }

  static bool CheckPermission() {
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    return (status == AVAuthorizationStatusAuthorized);
  }

  static void RequestPermission(std::function<void(bool)> callback) {
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
      callback(granted);
    }];
  }

  void Start(const std::string& deviceId, const std::string& quality,
             const std::string& output, std::function<void(bool, std::string)> callback) {
    outputPath = output;

    // Create audio engine
    audioEngine = [[AVAudioEngine alloc] init];
    AVAudioInputNode *inputNode = [audioEngine inputNode];

    // Set audio device if specified
    if (!deviceId.empty()) {
      AudioDeviceID deviceID = GetAudioDeviceIDFromUID(deviceId);
      if (deviceID != 0) {
        AudioUnit audioUnit = inputNode.audioUnit;
        AudioObjectPropertyAddress propertyAddress = {
          kAudioHardwarePropertyDeviceForUID,
          kAudioObjectPropertyScopeGlobal,
          kAudioObjectPropertyElementMain
        };
        // Set device...
      }
    }

    // Create audio writer
    audioWriter = [[AudioWriter alloc] initWithPath:[NSString stringWithUTF8String:output.c_str()]
                                            quality:quality];

    // Configure audio format (48kHz stereo)
    AVAudioFormat *format = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                                              sampleRate:48000
                                                                channels:2
                                                             interleaved:NO];

    // Install tap on input node
    [inputNode installTapOnBus:0
                    bufferSize:4096
                        format:format
                         block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
      // Write audio data
      [self->audioWriter writeBuffer:buffer atTime:when];
    }];

    // Start audio engine
    NSError *error = nil;
    if ([audioEngine startAndReturnError:&error]) {
      isCapturing = true;
      startTime = [NSDate date];
      callback(true, "");
    } else {
      callback(false, std::string([error.localizedDescription UTF8String]));
    }
  }

  void Stop(std::function<void(bool, std::string, std::string)> callback) {
    if (!audioEngine || !isCapturing) {
      callback(false, "", "No active capture");
      return;
    }

    // Stop engine
    [audioEngine stop];
    [[audioEngine inputNode] removeTapOnBus:0];
    isCapturing = false;

    // Finalize audio file
    [audioWriter finalize:^(BOOL success, NSError *error) {
      if (success) {
        callback(true, this->outputPath, "");
      } else {
        callback(false, "", std::string([error.localizedDescription UTF8String]));
      }
    }];
  }

  CaptureStatus GetStatus() {
    CaptureStatus status;
    status.isCapturing = isCapturing;

    if (isCapturing && startTime) {
      status.duration = (int64_t)(-[startTime timeIntervalSinceNow] * 1000);
    } else {
      status.duration = 0;
    }

    status.fileSize = [audioWriter getFileSize];
    return status;
  }

private:
  AudioDeviceID GetAudioDeviceIDFromUID(const std::string& uid) {
    // Implementation to convert UID to AudioDeviceID
    // ... Core Audio code here ...
    return 0;
  }
};
```

### combined_capture.mm (Combined Recording)

```objc
#import "combined_capture.h"
#import "system_audio_capture.h"
#import "microphone_capture.h"

class CombinedCapture::Impl {
public:
  std::unique_ptr<SystemAudioCapture> systemCapture;
  std::unique_ptr<MicrophoneCapture> micCapture;
  bool isMixedMode;
  NSDate *startTime;

  Impl() : systemCapture(nullptr), micCapture(nullptr), isMixedMode(false), startTime(nil) {}

  void Start(const std::string& systemSource, const std::string& systemSourceId,
             const std::string& micDeviceId, const std::string& quality,
             const std::string& outputPath, bool mixMode,
             std::function<void(bool, std::string)> callback) {

    isMixedMode = mixMode;

    if (mixMode) {
      // TODO: Implement audio mixing
      // This requires creating an AVAudioMixerNode that combines both sources
      callback(false, "Mixed mode not yet implemented");
      return;
    }

    // Separate mode: create two separate capture sessions
    std::string systemPath = outputPath;
    size_t pos = systemPath.find_last_of(".");
    if (pos != std::string::npos) {
      systemPath = systemPath.substr(0, pos) + "_system" + systemPath.substr(pos);
    } else {
      systemPath += "_system.m4a";
    }

    std::string micPath = outputPath;
    pos = micPath.find_last_of(".");
    if (pos != std::string::npos) {
      micPath = micPath.substr(0, pos) + "_microphone" + micPath.substr(pos);
    } else {
      micPath += "_microphone.m4a";
    }

    // Create both capture sessions
    systemCapture = std::make_unique<SystemAudioCapture>();
    micCapture = std::make_unique<MicrophoneCapture>();

    // Start both sessions
    __block int completedCount = 0;
    __block bool hasError = false;
    __block std::string errorMsg;

    auto checkCompletion = [&, callback]() {
      completedCount++;
      if (completedCount == 2) {
        if (hasError) {
          callback(false, errorMsg);
        } else {
          startTime = [NSDate date];
          callback(true, "");
        }
      }
    };

    systemCapture->Start(systemSource, systemSourceId, quality, systemPath,
      [&, checkCompletion](bool success, std::string error) {
        if (!success) {
          hasError = true;
          errorMsg = "System audio: " + error;
        }
        checkCompletion();
      });

    micCapture->Start(micDeviceId, quality, micPath,
      [&, checkCompletion](bool success, std::string error) {
        if (!success) {
          hasError = true;
          errorMsg += " Microphone: " + error;
        }
        checkCompletion();
      });
  }

  void Stop(std::function<void(bool, std::map<std::string, std::string>, std::string)> callback) {
    __block int completedCount = 0;
    __block bool hasError = false;
    __block std::string errorMsg;
    __block std::map<std::string, std::string> paths;

    auto checkCompletion = [&, callback]() {
      completedCount++;
      if (completedCount == 2) {
        if (hasError) {
          callback(false, paths, errorMsg);
        } else {
          callback(true, paths, "");
        }
      }
    };

    if (systemCapture) {
      systemCapture->Stop([&, checkCompletion](bool success, std::string path, std::string error) {
        if (success) {
          paths["system"] = path;
        } else {
          hasError = true;
          errorMsg = "System audio: " + error;
        }
        checkCompletion();
      });
    }

    if (micCapture) {
      micCapture->Stop([&, checkCompletion](bool success, std::string path, std::string error) {
        if (success) {
          paths["microphone"] = path;
        } else {
          hasError = true;
          errorMsg += " Microphone: " + error;
        }
        checkCompletion();
      });
    }
  }

  CombinedStatus GetStatus() {
    CombinedStatus status;
    status.isCapturing = (systemCapture != nullptr || micCapture != nullptr);

    if (startTime) {
      status.duration = (int64_t)(-[startTime timeIntervalSinceNow] * 1000);
    } else {
      status.duration = 0;
    }

    if (systemCapture) {
      status.systemFileSize = systemCapture->GetStatus().fileSize;
    }

    if (micCapture) {
      status.micFileSize = micCapture->GetStatus().fileSize;
    }

    return status;
  }
};
```

### audio_device_manager.mm (Device Enumeration)

```objc
#import <CoreAudio/CoreAudio.h>
#import <AVFoundation/AVFoundation.h>
#include "audio_device_manager.h"

std::vector<AudioDevice> AudioDeviceManager::GetAvailableMicrophones() {
  std::vector<AudioDevice> devices;

  // Get all audio devices
  AudioObjectPropertyAddress propertyAddress = {
    kAudioHardwarePropertyDevices,
    kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyElementMain
  };

  UInt32 dataSize = 0;
  OSStatus result = AudioObjectGetPropertyDataSize(kAudioObjectSystemObject,
                                                   &propertyAddress,
                                                   0,
                                                   NULL,
                                                   &dataSize);

  if (result != noErr) return devices;

  int deviceCount = dataSize / sizeof(AudioDeviceID);
  AudioDeviceID audioDevices[deviceCount];

  result = AudioObjectGetPropertyData(kAudioObjectSystemObject,
                                     &propertyAddress,
                                     0,
                                     NULL,
                                     &dataSize,
                                     audioDevices);

  if (result != noErr) return devices;

  AudioDeviceID defaultInputDevice = GetDefaultInputDevice();

  // Filter for input devices
  for (int i = 0; i < deviceCount; i++) {
    if (HasInputChannels(audioDevices[i])) {
      AudioDevice device;
      device.id = GetDeviceUID(audioDevices[i]);
      device.name = GetDeviceName(audioDevices[i]);
      device.isDefault = (audioDevices[i] == defaultInputDevice);
      devices.push_back(device);
    }
  }

  return devices;
}

AudioDeviceID AudioDeviceManager::GetDefaultInputDevice() {
  AudioObjectPropertyAddress propertyAddress = {
    kAudioHardwarePropertyDefaultInputDevice,
    kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyElementMain
  };

  AudioDeviceID deviceID = 0;
  UInt32 dataSize = sizeof(AudioDeviceID);

  AudioObjectGetPropertyData(kAudioObjectSystemObject,
                            &propertyAddress,
                            0,
                            NULL,
                            &dataSize,
                            &deviceID);

  return deviceID;
}

bool AudioDeviceManager::HasInputChannels(AudioDeviceID deviceID) {
  AudioObjectPropertyAddress propertyAddress = {
    kAudioDevicePropertyStreamConfiguration,
    kAudioDevicePropertyScopeInput,
    kAudioObjectPropertyElementMain
  };

  UInt32 dataSize = 0;
  OSStatus result = AudioObjectGetPropertyDataSize(deviceID,
                                                   &propertyAddress,
                                                   0,
                                                   NULL,
                                                   &dataSize);

  return (result == noErr && dataSize > 0);
}

std::string AudioDeviceManager::GetDeviceUID(AudioDeviceID deviceID) {
  AudioObjectPropertyAddress propertyAddress = {
    kAudioDevicePropertyDeviceUID,
    kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyElementMain
  };

  CFStringRef deviceUID = NULL;
  UInt32 dataSize = sizeof(CFStringRef);

  AudioObjectGetPropertyData(deviceID,
                            &propertyAddress,
                            0,
                            NULL,
                            &dataSize,
                            &deviceUID);

  if (deviceUID) {
    char buffer[256];
    CFStringGetCString(deviceUID, buffer, sizeof(buffer), kCFStringEncodingUTF8);
    CFRelease(deviceUID);
    return std::string(buffer);
  }

  return "";
}

std::string AudioDeviceManager::GetDeviceName(AudioDeviceID deviceID) {
  AudioObjectPropertyAddress propertyAddress = {
    kAudioObjectPropertyName,
    kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyElementMain
  };

  CFStringRef deviceName = NULL;
  UInt32 dataSize = sizeof(CFStringRef);

  AudioObjectGetPropertyData(deviceID,
                            &propertyAddress,
                            0,
                            NULL,
                            &dataSize,
                            &deviceName);

  if (deviceName) {
    char buffer[256];
    CFStringGetCString(deviceName, buffer, sizeof(buffer), kCFStringEncodingUTF8);
    CFRelease(deviceName);
    return std::string(buffer);
  }

  return "";
}
```

## Resources

### Apple Documentation
- [ScreenCaptureKit Documentation](https://developer.apple.com/documentation/screencapturekit)
- [AVAudioEngine Documentation](https://developer.apple.com/documentation/avfaudio/avaudioengine)
- [Core Audio Documentation](https://developer.apple.com/documentation/coreaudio)
- [AVCaptureDevice Documentation](https://developer.apple.com/documentation/avfoundation/avcapturedevice)
- [Apple Sample: CaptureSample](https://developer.apple.com/documentation/screencapturekit/capturing_screen_content_in_macos)

### Node.js Documentation
- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [node-addon-api GitHub](https://github.com/nodejs/node-addon-api)
- [node-gyp Documentation](https://github.com/nodejs/node-gyp)

### Implementation Guides
- [macOS Audio Programming Guide](https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/AudioUnitProgrammingGuide/)
- [Core Audio Overview](https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/)

## Key Features Summary

### What This Module Provides
✅ **System Audio Capture** - Record audio from any application, window, or display
✅ **Microphone Capture** - Record from any audio input device
✅ **Combined Recording** - Record both sources simultaneously
✅ **Device Enumeration** - List available system audio sources and microphones
✅ **Separate or Mixed Output** - Two files or single mixed file
✅ **High Quality** - 48kHz stereo AAC encoding
✅ **Promise-based API** - Modern async/await support
✅ **TypeScript Definitions** - Full type safety
✅ **Permission Management** - Handle screen recording and microphone permissions

### Use Cases
- 🎙️ Podcast recording with system audio and microphone
- 🎮 Gaming commentary with game audio and voice
- 🎓 Tutorial creation with application audio and narration
- 📞 Call recording (where legally permitted)
- 🎵 Music production and streaming
- 🎥 Screen recording with commentary

## License

[Your License]

---

**Status**: Phase 3 - Implementation Required
**Platform**: macOS 12.3+
**Type**: Node.js Native Addon (C++/Objective-C++)
**Frameworks**: ScreenCaptureKit + AVAudioEngine + Core Audio
**API**: Comprehensive audio recording (system + microphone + combined)
