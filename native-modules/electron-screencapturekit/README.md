# electron-screencapturekit

Node.js native addon for macOS system audio capture using ScreenCaptureKit.

## Overview

This is a **Node.js native addon** (not an Expo module) that wraps Apple's ScreenCaptureKit framework to enable system audio recording in Electron apps.

## Features

- ✅ Capture system audio from:
  - Entire display
  - Specific window
  - Specific application
- ✅ High-quality audio (48kHz stereo AAC)
- ✅ Async API with Promises
- ✅ Real-time status updates
- ✅ Permission management

## Requirements

- **macOS**: 12.3+ (Monterey or later - ScreenCaptureKit availability)
- **Xcode**: 13+ with Command Line Tools
- **Node.js**: 20+ (for Node-API v9)
- **node-gyp**: Latest version

## Installation

```bash
cd native-modules/electron-screencapturekit
pnpm install
pnpm build
```

## API

### TypeScript Definitions

```typescript
interface CaptureOptions {
  source: 'display' | 'window' | 'application';
  sourceId?: string;  // Display ID, window ID, or bundle identifier
  quality: 'low' | 'medium' | 'high';
  outputPath: string;
}

interface CaptureStatus {
  isCapturing: boolean;
  duration: number;  // milliseconds
  fileSize: number;  // bytes
}

export function checkPermission(): Promise<boolean>;
export function requestPermission(): Promise<boolean>;
export function startCapture(options: CaptureOptions): Promise<void>;
export function stopCapture(): Promise<string>; // Returns output file path
export function getStatus(): CaptureStatus;
```

### Usage

```javascript
const screencapture = require('@recording-app/electron-screencapturekit');

// Check permission
const hasPermission = await screencapture.checkPermission();

if (!hasPermission) {
  // Request permission (opens System Preferences)
  const granted = await screencapture.requestPermission();

  if (!granted) {
    throw new Error('Permission denied');
  }
}

// Start capture
await screencapture.startCapture({
  source: 'display',
  quality: 'high',
  outputPath: '/path/to/output.m4a',
});

// Get status
const status = screencapture.getStatus();
console.log(`Recording: ${status.duration}ms, ${status.fileSize} bytes`);

// Stop capture
const filePath = await screencapture.stopCapture();
console.log(`Saved to: ${filePath}`);
```

## Implementation

### Project Structure

```
electron-screencapturekit/
├── src/
│   ├── binding.cpp              # Node-API bindings
│   ├── screencapture.h          # C++ header
│   ├── screencapture.mm         # Objective-C++ implementation
│   └── audio_writer.mm          # Audio file writer
├── binding.gyp                  # node-gyp build config
├── index.js                     # JavaScript exports
├── index.d.ts                   # TypeScript definitions
├── package.json
└── README.md
```

### binding.cpp (Node-API Bindings)

```cpp
#include <napi.h>
#include "screencapture.h"

// Global capture session
static std::unique_ptr<ScreenCaptureSession> captureSession;

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
pnpm install

# Configure
pnpm run build

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
pnpm install
```

## Resources

- [ScreenCaptureKit Documentation](https://developer.apple.com/documentation/screencapturekit)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [node-addon-api GitHub](https://github.com/nodejs/node-addon-api)
- [Apple Sample: CaptureSample](https://developer.apple.com/documentation/screencapturekit/capturing_screen_content_in_macos)

## License

[Your License]

---

**Status**: Phase 3 - Implementation Required
**Platform**: macOS 12.3+
**Type**: Node.js Native Addon
