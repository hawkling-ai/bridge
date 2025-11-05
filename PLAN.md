# Recording App - Implementation Plan

## Purpose

Reliable audio recording for telehealth sessions. Captures audio from telehealth platforms (Zoom, Teams, browser-based) with robust handling of interruptions (phone calls, system alerts). Minimal scope: recording only, no playback or transcription.

## Use Case

Medical professionals conducting telehealth visits need to record sessions reliably across different platforms and devices. The app must handle real-world interruptions without losing audio data.

## Architecture

**Monorepo with 80-90% code sharing:**
- Desktop (macOS/Windows/Linux): Electron + React Native Web
- Mobile (iOS): React Native + Expo
- Shared package: UI components, business logic, state management

**Why this stack:**
- React Native Web enables component reuse across platforms
- Electron provides native desktop capabilities
- Expo simplifies iOS development with modern APIs
- Single TypeScript codebase

## Technology Stack

**Core:**
- React 18.3.x
- TypeScript 5.3+ (strict mode)
- Node.js 20+ LTS

**Mobile (iOS):**
- React Native 0.76.x
- Expo SDK 54
- expo-audio 14.0 (Note: expo-av deprecated, removed in SDK 54)

**Desktop:**
- Electron 32.x
- React Native Web 0.19.x
- Vite (bundler)

**Shared:**
- Zustand (state management)
- pnpm workspaces + Turborepo (monorepo)

## Feature Specification

### 1. Audio Recording

**Microphone Recording**
- Platform: iOS and desktop
- Quality: 48kHz stereo, AAC encoding, 192kbps
- Format: .m4a
- Background recording: Supported on iOS

**System Audio Recording**
- Platform: macOS only (ScreenCaptureKit framework)
- Captures audio output from telehealth apps
- Requires Screen Recording permission
- Quality: Same as microphone

**Unsupported:**
- iOS system audio (Apple security restriction)
- Windows/Linux system audio (future)

### 2. Interruption Handling

**Critical requirement:** Must not lose audio during interruptions.

**iOS Interruptions:**
- Incoming phone calls
- FaceTime calls
- Alarms and timers
- Siri activation
- Other apps requesting audio focus

**Handling strategy:**
```
Interruption begins -> Pause recording
User declines interruption -> Resume recording
User accepts interruption -> Stop and save partial recording
```

**Implementation:**
- Use AVAudioSession interruption notifications
- Save recording state on interruption
- Mark recordings with interruption metadata
- Resume automatically when possible

**Desktop Interruptions:**
- System sleep/wake
- Audio device changes
- App focus changes
- Handle gracefully, continue recording

### 3. File Management

**Storage:**
- iOS: App documents directory
- Desktop: User's documents/recordings folder
- Filename format: `recording_YYYYMMDD_HHMMSS.m4a`

**Metadata:**
```typescript
interface Recording {
  id: string;
  filename: string;
  startTime: number;        // Unix timestamp
  endTime: number;
  duration: number;         // seconds
  size: number;             // bytes
  recordingMode: 'microphone' | 'system';
  interrupted: boolean;
  interruptionCount: number;
  platform: 'ios' | 'macos' | 'windows' | 'linux';
}
```

**Operations:**
- List all recordings
- Delete recording (file + metadata)
- Query metadata
- Calculate total storage used

**Persistence:**
- iOS: AsyncStorage for metadata
- Desktop: localStorage for metadata
- Files stored in filesystem

### 4. Permissions

**iOS:**
- Microphone: NSMicrophoneUsageDescription in Info.plist
- Background audio: UIBackgroundModes: ["audio"]
- Request on first recording attempt
- Handle all permission states: not-determined, denied, granted, restricted

**macOS:**
- Microphone: Standard permission request
- Screen Recording: Required for system audio
  - User must manually enable in System Preferences
  - App detects and guides user to settings

**Permission flow:**
1. Check permission status
2. Request if not-determined
3. Show clear error if denied
4. Provide link to settings

### 5. User Interface

**Minimal design principle:** Function over form.

**Recording Screen:**
- Record button (single action: start/stop)
- Duration timer (active during recording)
- Recording mode selector (desktop only: microphone/system)
- Permission status indicator
- Available storage display

**Recordings List:**
- Chronological list, newest first
- Per recording: filename, duration, size, timestamp
- Delete button
- Total count and total size
- No preview, no playback controls

**No features:**
- Playback UI (out of scope)
- Waveform visualization
- Editing tools
- Export/share functionality (files accessible via filesystem)

### 6. Error Handling

**Error categories:**

**Permission errors:**
- Microphone permission denied
- Screen Recording permission denied (macOS)
- Action: Clear message, link to settings

**Storage errors:**
- Disk full
- Write permission denied
- Action: Stop recording, save partial if possible, alert user

**Recording errors:**
- Audio device unavailable
- Recording failed to start
- Recording corrupted
- Action: Log error, alert user, cleanup

**Interruption errors:**
- Failed to resume after interruption
- Action: Save partial recording, mark as interrupted

**Error display:**
- Non-modal alerts for non-critical errors
- Modal alerts for critical errors (storage full)
- Log all errors for debugging

### 7. Reliability

**Crash recovery:**
- Periodically save recording state (every 30 seconds)
- On app restart, check for incomplete recordings
- Offer to recover or discard

**Storage monitoring:**
- Check available storage before recording
- Warn at < 500MB available
- Block recording at < 100MB available
- Display available storage in UI

**Background recording (iOS):**
- Audio session configured for background
- Recording continues when app backgrounded
- Recording continues when screen locked
- Stop recording on app termination (save file)

**Data integrity:**
- Flush audio buffer regularly
- Verify file written successfully
- Checksum validation (optional)

## Project Structure

```
recording-app/
├── packages/
│   ├── mobile/                           # iOS app
│   │   ├── app/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx            # Recording screen
│   │   │   │   └── recordings.tsx       # List screen
│   │   │   └── _layout.tsx
│   │   ├── app.json                     # Expo config
│   │   └── package.json
│   │
│   ├── desktop/                          # Electron app
│   │   ├── src/
│   │   │   ├── main/                    # Main process
│   │   │   │   ├── index.ts
│   │   │   │   ├── ipc-handlers.ts
│   │   │   │   └── audio/
│   │   │   │       └── macos-capture.ts
│   │   │   ├── renderer/                # Renderer process
│   │   │   │   └── index.tsx
│   │   │   └── preload.ts
│   │   ├── electron-builder.json
│   │   └── package.json
│   │
│   └── shared/                           # Shared code (80-90%)
│       ├── src/
│       │   ├── features/recording/
│       │   │   ├── components/
│       │   │   │   ├── RecordButton.tsx
│       │   │   │   ├── RecordingTimer.tsx
│       │   │   │   └── RecordingsList.tsx
│       │   │   ├── hooks/
│       │   │   │   ├── useRecording.ts
│       │   │   │   ├── useInterruptionHandler.ts
│       │   │   │   └── usePermissions.ts
│       │   │   ├── store/
│       │   │   │   └── recordingStore.ts    # Zustand
│       │   │   ├── services/
│       │   │   │   ├── audioService.ts       # Platform abstraction
│       │   │   │   └── storageService.ts
│       │   │   └── types/
│       │   │       └── recording.types.ts
│       │   └── utils/
│       │       ├── platform.ts               # Platform detection
│       │       └── formatters.ts
│       └── package.json
│
├── native-modules/
│   └── electron-screencapturekit/       # Node.js addon for macOS
│       ├── src/
│       │   ├── binding.cpp               # Node-API bindings
│       │   └── screencapture.mm          # ScreenCaptureKit wrapper
│       ├── binding.gyp
│       └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md                   # Technical architecture
│   └── INTERRUPTIONS.md                  # Interruption handling guide
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Implementation Details

### iOS Recording with Interruption Handling

```typescript
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useRecordingWithInterruptions() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  const [interrupted, setInterrupted] = useState(false);
  const [interruptionCount, setInterruptionCount] = useState(0);

  // Configure audio session
  useEffect(() => {
    (async () => {
      await AudioModule.requestRecordingPermissionsAsync();

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        staysActiveInBackground: true,
      });
    })();
  }, []);

  // Handle interruptions
  useEffect(() => {
    const sub = AudioModule.addAudioSessionInterruptionListener((event) => {
      if (event.type === 'began') {
        setInterrupted(true);
        setInterruptionCount(prev => prev + 1);
      } else if (event.type === 'ended') {
        if (event.shouldResume) {
          setInterrupted(false);
        } else {
          stopRecording();
        }
      }
    });

    return () => sub.remove();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // Recording continues in background
      console.log('App state:', state);
    });

    return () => sub.remove();
  }, []);

  const startRecording = async () => {
    setInterrupted(false);
    setInterruptionCount(0);
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    await recorder.stop();
    return {
      uri: recorder.uri,
      duration: state.durationMillis / 1000,
      interrupted,
      interruptionCount,
    };
  };

  return {
    startRecording,
    stopRecording,
    isRecording: state.isRecording,
    duration: state.durationMillis,
    interrupted,
    interruptionCount,
  };
}
```

### macOS System Audio via Electron IPC

```typescript
// Main process
ipcMain.handle('recording:start', async (event, mode: 'mic' | 'system') => {
  if (mode === 'system' && process.platform === 'darwin') {
    const hasPermission = await checkScreenRecordingPermission();
    if (!hasPermission) {
      throw new Error('Screen Recording permission required');
    }

    const addon = require('@recording-app/electron-screencapturekit');
    await addon.startCapture({
      source: 'display',
      quality: 'high',
      outputPath: generateFilePath(),
    });
  }
});

// Renderer process
async function startSystemAudioRecording() {
  await window.electron.recording.start('system');
}
```

## Configuration

### app.json (iOS)

```json
{
  "expo": {
    "name": "Recording App",
    "slug": "recording-app",
    "version": "1.0.0",
    "platforms": ["ios"],
    "plugins": [
      ["expo-audio", {
        "microphonePermission": "Required to record telehealth sessions."
      }],
      "expo-router"
    ],
    "ios": {
      "bundleIdentifier": "com.recordingapp.ios",
      "supportsTablet": true,
      "deploymentTarget": "17.0",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Record telehealth sessions.",
        "UIBackgroundModes": ["audio"]
      }
    }
  }
}
```

### electron-builder.json

```json
{
  "appId": "com.recordingapp.desktop",
  "productName": "Recording App",
  "mac": {
    "target": ["dmg"],
    "category": "public.app-category.medical",
    "entitlements": "entitlements.mac.plist"
  }
}
```

### entitlements.mac.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.device.audio-input</key>
  <true/>
</dict>
</plist>
```

## Testing Requirements

### Interruption Testing (Critical)

**Test matrix:**
1. Record 2 minutes, receive call, decline, verify continuous recording
2. Record 2 minutes, receive call, accept, verify partial file saved
3. Record, trigger alarm, verify pause/resume
4. Record, activate Siri, verify pause/resume
5. Record, background app for 5 minutes, verify continues
6. Record, lock screen, unlock, verify continues
7. Record with low storage (< 200MB), verify warning
8. Record with critical storage (< 100MB), verify blocked

**Telehealth platform testing:**
- Zoom desktop client
- Microsoft Teams desktop client
- Google Meet (browser)
- Doxy.me (browser)
- Verify audio captured correctly from each

### Platform Testing

**iOS:**
- iPhone 12 or later (iOS 17+)
- iPad (iPadOS 17+)
- Various interruption scenarios
- Background recording for extended periods

**macOS:**
- macOS 12.3+ (Monterey or later)
- Intel and Apple Silicon
- Multiple display configurations
- Permission flow verification

## Build & Deployment

### iOS

```bash
cd packages/mobile

# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build for development
eas build --profile development --platform ios

# Build for production
eas build --profile production --platform ios
```

### macOS Desktop

```bash
cd packages/desktop

# Development
pnpm dev

# Build
pnpm build:mac
```

## Dependencies

### Root

```json
{
  "name": "recording-app",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Mobile

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

### Desktop

```json
{
  "dependencies": {
    "electron": "^32.0.0",
    "@recording-app/shared": "workspace:*",
    "@recording-app/electron-screencapturekit": "workspace:*"
  }
}
```

### Shared

```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-web": "~0.19.0",
    "zustand": "^5.0.0",
    "@react-native-async-storage/async-storage": "^1.23.0"
  }
}
```

## Platform Limitations

**iOS:**
- Microphone recording only (no system audio)
- Background recording supported
- Interruptions handled automatically
- iOS 17.0+ required

**macOS:**
- Microphone and system audio supported
- Requires macOS 12.3+ for system audio
- User must manually enable Screen Recording permission
- No automatic permission request API

**Windows/Linux:**
- Microphone only (system audio future)

## Out of Scope

The following features are explicitly excluded:

- Audio playback UI
- Transcription
- AI processing
- Note taking
- Export/share UI
- Cloud storage
- Waveform visualization
- Audio editing
- Multiple file formats
- Compression options

Files are accessible via filesystem. Users can manually share/export using OS tools.

---

**Version**: 1.0
**Last Updated**: 2025-01-05
**Focus**: Minimal, reliable recording for telehealth with interruption handling
