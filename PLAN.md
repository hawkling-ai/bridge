# Recording App - Implementation Plan (REVISED)

## Overview
A cross-platform audio recording application built with **Electron + React Native Web** (desktop) and **React Native/Expo** (iOS), maximizing code sharing while supporting microphone recording on both platforms and system audio capture on macOS.

## Architecture Decision

### Shared Web View Approach
- **Desktop (macOS/Windows/Linux)**: Electron + React Native Web
- **Mobile (iOS)**: React Native + Expo
- **Shared Code**: ~80-90% code reuse via React Native Web
- **Platform-Specific**: Native audio modules for each platform

### Why This Architecture?
1. **Maximum Code Reuse**: UI, business logic, and state management shared
2. **Native Performance**: Native audio modules where needed
3. **Single Team**: One codebase, one team
4. **Familiar Stack**: React/TypeScript everywhere

## Technology Stack

### Core Framework
- **React**: 18.3.x
- **React Native**: 0.76.x (for iOS)
- **React Native Web**: 0.19.x (for Electron)
- **Electron**: 32.x (for desktop)
- **Expo SDK**: 54 (latest - Feb 2025, expo-av removed)
- **TypeScript**: 5.3+ (strict mode)
- **Node.js**: 20+ LTS

### Key Libraries
| Library | Version | Purpose | Platform |
|---------|---------|---------|----------|
| `expo-audio` | ~14.0.0 | Audio recording (iOS) | iOS only |
| `electron` | ^32.0.0 | Desktop wrapper | Desktop |
| `react-native-web` | ~0.19.0 | Web compatibility | Desktop |
| `zustand` | ^5.0.0 | State management | All |
| `@electron/remote` | ^2.1.0 | IPC communication | Desktop |

### Development Tools
- **Vite**: Fast bundler for Electron renderer
- **EAS CLI**: For iOS builds
- **TypeScript**: Strict mode with path aliases
- **Jest + React Testing Library**: Testing

## Critical API Updates

### expo-av is DEPRECATED ⚠️
- **SDK 52**: expo-audio introduced (beta)
- **SDK 53**: expo-audio stable
- **SDK 54**: expo-av **completely removed** from Expo Go
- **Migration Required**: Use `expo-audio` for all new projects

### expo-audio vs expo-av

| Feature | expo-av (OLD) | expo-audio (NEW) |
|---------|---------------|------------------|
| API Style | Class-based | Hooks-based |
| Recording | `Audio.Recording.createAsync()` | `useAudioRecorder()` |
| Permissions | `Audio.usePermissions()` | `AudioModule.requestRecordingPermissionsAsync()` |
| Status Updates | Callback-based | `useAudioRecorderState()` hook |
| Lifecycle | Manual cleanup | Automatic via hooks |
| Status | **Deprecated** | **Current** |

## Platform Support

### iOS (17.0+) - React Native + Expo
- ✅ Microphone recording via **expo-audio**
- ✅ Background audio recording (UIBackgroundModes)
- ❌ System audio capture (impossible - Apple security)
- ✅ Audio format: .m4a (AAC, HIGH_QUALITY preset)
- ✅ Built with EAS Build

### macOS Desktop - Electron
- ✅ Microphone recording via Web Audio API / node-mic
- ✅ System audio capture via **ScreenCaptureKit** (Node.js addon)
- ✅ Audio format: .m4a (AAC) or .webm
- ⚠️ Requires screen recording permission (user must enable in System Preferences)
- ✅ Electron packager for distribution

### Windows Desktop - Electron (Future)
- ✅ Microphone recording via Web Audio API
- 🔄 System audio capture via WASAPI (Node.js addon)
- ✅ Audio format: .webm

### Linux Desktop - Electron (Future)
- ✅ Microphone recording via Web Audio API
- 🔄 System audio capture via PulseAudio (Node.js addon)
- ✅ Audio format: .webm

## Project Structure

```
recording-app/                         # Monorepo root
├── packages/
│   ├── mobile/                        # iOS React Native app
│   │   ├── app/                       # Expo Router
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx          # Recording screen
│   │   │   │   └── recordings.tsx     # Recordings list
│   │   │   └── _layout.tsx
│   │   ├── app.json                   # Expo config
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── desktop/                       # Electron app
│   │   ├── src/
│   │   │   ├── main/                  # Electron main process
│   │   │   │   ├── index.ts           # Main entry
│   │   │   │   ├── ipc.ts             # IPC handlers
│   │   │   │   └── audio/             # Native audio modules
│   │   │   │       ├── macos-screencapturekit.node  # Native addon
│   │   │   │       └── binding.ts     # Node binding
│   │   │   ├── renderer/              # Electron renderer (React)
│   │   │   │   └── index.tsx          # Uses shared code
│   │   │   └── preload.ts             # Preload script
│   │   ├── electron-builder.json      # Packaging config
│   │   ├── package.json
│   │   └── vite.config.ts             # Vite for renderer
│   │
│   └── shared/                        # Shared code (80-90% of app)
│       ├── src/
│       │   ├── features/              # Feature modules
│       │   │   └── recording/
│       │   │       ├── components/
│       │   │       │   ├── RecordButton.tsx
│       │   │       │   ├── RecordingTimer.tsx
│       │   │       │   └── RecordingsList.tsx
│       │   │       ├── hooks/
│       │   │       │   ├── useRecording.ts
│       │   │       │   └── useRecordingPermissions.ts
│       │   │       ├── store/
│       │   │       │   └── recordingStore.ts    # Zustand
│       │   │       └── types/
│       │   │           └── recording.types.ts
│       │   ├── services/              # Platform-agnostic services
│       │   │   ├── audioService.ts    # Audio interface
│       │   │   └── storageService.ts  # File operations
│       │   ├── components/            # Shared UI
│       │   ├── utils/
│       │   └── types/
│       ├── package.json
│       └── tsconfig.json
│
├── native-modules/                    # Native code
│   ├── electron-screencapturekit/     # Node.js addon for macOS
│   │   ├── src/
│   │   │   ├── screencapture.mm       # Objective-C++
│   │   │   └── binding.cpp            # Node-API binding
│   │   ├── binding.gyp
│   │   └── package.json
│   │
│   └── expo-system-audio/             # iOS module (if needed beyond expo-audio)
│       └── ...
│
├── docs/                              # Documentation
│   ├── ARCHITECTURE.md
│   ├── ELECTRON_SETUP.md
│   └── IOS_SETUP.md
│
├── package.json                       # Root package.json
├── pnpm-workspace.yaml                # PNPM workspaces
└── turbo.json                         # Turborepo config
```

## Real expo-audio Implementation (iOS)

### Official Example (from Expo docs)

```typescript
import { useState, useEffect } from 'react';
import { View, StyleSheet, Button, Alert } from 'react-native';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
} from 'expo-audio';

export default function RecordingScreen() {
  // Create recorder with HIGH_QUALITY preset
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Get real-time recording state
  const recorderState = useAudioRecorderState(audioRecorder);

  const record = async () => {
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const stopRecording = async () => {
    await audioRecorder.stop();
    // Recording available at: audioRecorder.uri
    console.log('Recorded file:', audioRecorder.uri);
  };

  useEffect(() => {
    (async () => {
      // Request permission
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission to access microphone was denied');
        return;
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Button
        title={recorderState.isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={recorderState.isRecording ? stopRecording : record}
      />
      {recorderState.isRecording && (
        <Text>Duration: {Math.round(recorderState.durationMillis / 1000)}s</Text>
      )}
    </View>
  );
}
```

### Key API Details

**useAudioRecorder Hook:**
```typescript
const recorder = useAudioRecorder(
  RecordingPresets.HIGH_QUALITY,  // or LOW_QUALITY, or custom options
  (status) => console.log(status)  // Optional status listener
);

// Properties:
recorder.uri              // string | null - recorded file URI
recorder.isRecording      // boolean
recorder.durationMillis   // number

// Methods:
await recorder.prepareToRecordAsync()  // Must call before record()
recorder.record()                       // Start recording
await recorder.stop()                   // Stop and finalize
```

**useAudioRecorderState Hook:**
```typescript
const state = useAudioRecorderState(recorder, 500);  // Poll every 500ms

// State object:
state.isRecording      // boolean
state.durationMillis   // number
state.canRecord        // boolean
```

**Permissions:**
```typescript
// Request
const { granted, canAskAgain, status } =
  await AudioModule.requestRecordingPermissionsAsync();

// Check
const { granted, status } =
  await AudioModule.getRecordingPermissionsAsync();
```

**Audio Mode:**
```typescript
await setAudioModeAsync({
  allowsRecording: true,              // Enable recording
  playsInSilentMode: true,            // Play in silent mode
  shouldPlayInBackground: true,       // Background playback (optional)
  staysActiveInBackground: true,      // Background recording (optional)
});
```

## Electron Implementation (Desktop)

### Main Process (Node.js)

```typescript
// packages/desktop/src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { MacOSAudioCapture } from './audio/macos-capture';

let audioCapture: MacOSAudioCapture | null = null;

// IPC Handlers
ipcMain.handle('audio:checkPermission', async () => {
  if (process.platform === 'darwin') {
    return MacOSAudioCapture.checkScreenRecordingPermission();
  }
  return true;
});

ipcMain.handle('audio:startSystemCapture', async (event, options) => {
  if (process.platform !== 'darwin') {
    throw new Error('System audio only supported on macOS');
  }

  audioCapture = new MacOSAudioCapture(options);
  await audioCapture.start();
});

ipcMain.handle('audio:stopSystemCapture', async () => {
  if (!audioCapture) return null;

  const filePath = await audioCapture.stop();
  audioCapture = null;
  return filePath;
});
```

### Renderer Process (React Native Web)

```typescript
// packages/desktop/src/renderer/hooks/useSystemAudio.ts
import { useState } from 'react';

export function useSystemAudio() {
  const [isRecording, setIsRecording] = useState(false);

  const startCapture = async () => {
    const hasPermission = await window.electron.audio.checkPermission();

    if (!hasPermission) {
      // Guide user to System Preferences
      alert('Please enable Screen Recording in System Preferences');
      return;
    }

    await window.electron.audio.startSystemCapture({
      source: 'display',  // or 'window', 'application'
      quality: 'high',
    });

    setIsRecording(true);
  };

  const stopCapture = async () => {
    const filePath = await window.electron.audio.stopSystemCapture();
    setIsRecording(false);
    return filePath;
  };

  return { isRecording, startCapture, stopCapture };
}
```

### Preload Script

```typescript
// packages/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  audio: {
    checkPermission: () => ipcRenderer.invoke('audio:checkPermission'),
    startSystemCapture: (options) =>
      ipcRenderer.invoke('audio:startSystemCapture', options),
    stopSystemCapture: () =>
      ipcRenderer.invoke('audio:stopSystemCapture'),
  },
});
```

## Shared Code Strategy

### Platform Detection

```typescript
// packages/shared/src/utils/platform.ts
export const isElectron = () => {
  return typeof window !== 'undefined' &&
         (window as any).electron !== undefined;
};

export const isNative = () => {
  return !isElectron() &&
         typeof navigator !== 'undefined' &&
         navigator.product === 'ReactNative';
};

export const isIOS = () => {
  return isNative() && Platform.OS === 'ios';
};

export const isMacOS = () => {
  return isElectron() && process.platform === 'darwin';
};
```

### Unified Audio Service

```typescript
// packages/shared/src/services/audioService.ts
import { isElectron, isIOS } from '../utils/platform';

export class AudioService {
  static async startRecording(mode: 'microphone' | 'system') {
    if (mode === 'system') {
      if (!isElectron()) {
        throw new Error('System audio only available on desktop');
      }

      if (process.platform === 'darwin') {
        return window.electron.audio.startSystemCapture({
          source: 'display',
        });
      }
    }

    if (mode === 'microphone') {
      if (isIOS()) {
        // Use expo-audio (in mobile app)
        const { useRecording } = await import('@mobile/hooks/useRecording');
        return useRecording();
      }

      if (isElectron()) {
        // Use Web Audio API or node-mic
        return window.electron.audio.startMicrophoneCapture();
      }
    }
  }

  static async stopRecording() {
    // Platform-specific stop logic
  }
}
```

### Shared Components

```tsx
// packages/shared/src/features/recording/components/RecordButton.tsx
import { TouchableOpacity, View, Text } from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
}

export function RecordButton({ isRecording, onPress }: RecordButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: isRecording ? '#EF4444' : '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View style={{
        width: isRecording ? 30 : 0,
        height: isRecording ? 30 : 0,
        backgroundColor: '#fff',
        borderRadius: isRecording ? 4 : 0,
      }} />
    </TouchableOpacity>
  );
}
```

**This component works in:**
- ✅ React Native (iOS)
- ✅ React Native Web (Electron)
- ✅ Zero changes needed

## Implementation Phases

### Phase 1: Setup & Scaffolding (Week 1)
**Goals:**
- Monorepo setup (pnpm workspaces + turborepo)
- Shared package with basic UI
- iOS app with expo-audio recording
- Electron app shell

**Deliverables:**
1. Monorepo structure
2. TypeScript configs
3. Basic recording UI (shared component)
4. iOS microphone recording working
5. Electron app launches

### Phase 2: Core Features (Weeks 2-3)
**Goals:**
- File storage (both platforms)
- Recordings list
- Playback
- State management (Zustand)

**Deliverables:**
1. `storageService.ts` (platform-agnostic)
2. `recordingStore.ts` (Zustand store)
3. Recordings list component
4. Audio playback
5. Delete recordings

### Phase 3: macOS System Audio (Weeks 4-5)
**Goals:**
- Node.js native addon for ScreenCaptureKit
- Permission handling
- Source selection (display/window/app)

**Deliverables:**
1. `electron-screencapturekit` Node.js addon
2. IPC bridge to renderer
3. Permission UI flow
4. Source picker UI
5. macOS system audio capture working

### Phase 4: Polish (Week 6)
**Goals:**
- UI/UX refinement
- Error handling
- Testing
- App icons

**Deliverables:**
1. Waveform visualization
2. Error boundaries
3. Unit tests
4. E2E tests
5. App packaging

## Dependencies

### Shared Package
```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-web": "~0.19.0",
    "zustand": "^5.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.3.12"
  }
}
```

### Mobile Package (iOS)
```json
{
  "dependencies": {
    "expo": "~54.0.0",
    "expo-audio": "~14.0.0",
    "expo-router": "~4.0.0",
    "expo-file-system": "~18.0.0",
    "@recording-app/shared": "workspace:*"
  }
}
```

### Desktop Package (Electron)
```json
{
  "dependencies": {
    "electron": "^32.0.0",
    "@electron/remote": "^2.1.2",
    "vite": "^5.0.0",
    "@recording-app/shared": "workspace:*",
    "@recording-app/electron-screencapturekit": "workspace:*"
  }
}
```

### Native Module (macOS ScreenCaptureKit)
```json
{
  "dependencies": {
    "node-addon-api": "^8.0.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  }
}
```

## Configuration

### app.json (iOS - Expo)
```json
{
  "expo": {
    "name": "Recording App",
    "slug": "recording-app",
    "version": "1.0.0",
    "platforms": ["ios"],
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone for recording."
        }
      ],
      "expo-router"
    ],
    "ios": {
      "bundleIdentifier": "com.recordingapp.ios",
      "supportsTablet": true,
      "deploymentTarget": "17.0",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "We need microphone access to record audio.",
        "UIBackgroundModes": ["audio"]
      }
    }
  }
}
```

### electron-builder.json (Desktop)
```json
{
  "appId": "com.recordingapp.desktop",
  "productName": "Recording App",
  "directories": {
    "output": "dist"
  },
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.productivity",
    "entitlements": "entitlements.mac.plist",
    "entitlementsInherit": "entitlements.mac.plist",
    "hardenedRuntime": true
  },
  "dmg": {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ]
  }
}
```

### entitlements.mac.plist (macOS Permissions)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.device.camera</key>
  <false/>
</dict>
</plist>
```

## Native Module Implementation (macOS ScreenCaptureKit)

### Node.js Addon (not Expo module!)

```cpp
// native-modules/electron-screencapturekit/src/screencapture.mm
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <AVFoundation/AVFoundation.h>
#include <napi.h>

class ScreenCaptureSession {
private:
  SCStream* stream;
  AVAssetWriter* writer;

public:
  Napi::Promise Start(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto deferred = Napi::Promise::Deferred::New(env);

    // Get shareable content
    [SCShareableContent getShareableContentWithCompletionHandler:^(
      SCShareableContent* content, NSError* error
    ) {
      if (error) {
        deferred.Reject(Napi::Error::New(env, error.localizedDescription.UTF8String).Value());
        return;
      }

      // Configure stream
      SCStreamConfiguration* config = [[SCStreamConfiguration alloc] init];
      config.capturesAudio = YES;
      config.sampleRate = 48000;
      config.channelCount = 2;

      // Create filter (capture display)
      SCContentFilter* filter = [[SCContentFilter alloc]
        initWithDisplay:content.displays.firstObject
        excludingWindows:@[]];

      // Create stream
      stream = [[SCStream alloc]
        initWithFilter:filter
        configuration:config
        delegate:nil];

      // Start capture
      [stream startCaptureWithCompletionHandler:^(NSError* error) {
        if (error) {
          deferred.Reject(Napi::Error::New(env, error.localizedDescription.UTF8String).Value());
        } else {
          deferred.Resolve(env.Null());
        }
      }];
    }];

    return deferred.Promise();
  }

  Napi::Promise Stop(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto deferred = Napi::Promise::Deferred::New(env);

    [stream stopCaptureWithCompletionHandler:^(NSError* error) {
      if (error) {
        deferred.Reject(Napi::Error::New(env, error.localizedDescription.UTF8String).Value());
      } else {
        deferred.Resolve(Napi::String::New(env, outputPath.UTF8String));
      }
    }];

    return deferred.Promise();
  }
};

// Node-API bindings
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    ScreenCaptureSession session;
    return session.Start(info);
  }));

  exports.Set("stop", Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
    ScreenCaptureSession session;
    return session.Stop(info);
  }));

  return exports;
}

NODE_API_MODULE(screencapture, Init)
```

### binding.gyp
```python
{
  "targets": [
    {
      "target_name": "screencapture",
      "sources": [ "src/screencapture.mm" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "libraries": [
        "-framework ScreenCaptureKit",
        "-framework AVFoundation",
        "-framework CoreMedia"
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "12.3",
        "OTHER_CFLAGS": ["-ObjC++"]
      }
    }
  ]
}
```

## Build & Deployment

### iOS Build (EAS)
```bash
# Development build
eas build --profile development --platform ios

# Production build
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

### Electron Build
```bash
# macOS
npm run build:mac        # Creates .dmg and .zip
npm run build:mac:arm64  # Apple Silicon
npm run build:mac:x64    # Intel

# Windows (future)
npm run build:win

# Linux (future)
npm run build:linux
```

## Resources

- [expo-audio Official Docs](https://docs.expo.dev/versions/latest/sdk/audio/)
- [Expo Audio Recording Example (Official)](https://github.com/expo/audio-recording-example)
- [React Native Web](https://necolas.github.io/react-native-web/)
- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [ScreenCaptureKit (Apple)](https://developer.apple.com/documentation/screencapturekit)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)

## Success Criteria

### Phase 1 ✅
- [ ] Monorepo building successfully
- [ ] iOS app records microphone audio
- [ ] Electron app launches
- [ ] Shared components rendering on both platforms

### Phase 2 ✅
- [ ] Recordings saved to disk
- [ ] Recordings list shows saved files
- [ ] Playback works
- [ ] Delete works

### Phase 3 ✅
- [ ] macOS system audio capture works
- [ ] Permission flow complete
- [ ] Source selection works

### Phase 4 ✅
- [ ] No crashes
- [ ] Tests passing
- [ ] Apps packaged for distribution

---

**Document Version**: 2.0 (REVISED)
**Last Updated**: 2025-01-05
**Architecture**: Electron + React Native Web (Desktop) + React Native/Expo (iOS)
**Status**: Ready for Implementation
