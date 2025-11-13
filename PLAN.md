# Bridge - Desktop Recording App Implementation Plan

## Purpose

Electron-based desktop audio recording for telehealth sessions. Captures audio from telehealth platforms (Zoom, Teams, browser-based) with system audio support on macOS. Minimal scope: recording only, no playback or transcription.

## Use Case

Medical professionals conducting telehealth visits need to record sessions reliably on desktop. The app must capture system audio (what you hear from the computer) and handle real-world interruptions (device changes, system sleep) without losing audio data.

## Architecture

**Single Electron application:**
- Desktop (macOS/Windows/Linux): Electron + React
- Native module: ScreenCaptureKit (macOS) for system audio
- State management: Zustand
- Build: Vite

**Why this stack:**
- Electron provides cross-platform desktop capabilities
- React for modern UI development
- Native modules for platform-specific audio capture
- Single TypeScript codebase

## Technology Stack

**Core:**
- Electron 32.x
- React 18.3.x
- TypeScript 5.3+ (strict mode)
- Node.js 20+ LTS

**Frontend:**
- Vite (bundler)
- Zustand (state management)
- React hooks for UI logic

**Native (macOS):**
- Node-API (N-API) for native bindings
- ScreenCaptureKit framework for system audio
- Objective-C++/C++ for native module

**Build & Package:**
- electron-builder (packaging)
- node-gyp (native module compilation)
- pnpm (package manager)

## Feature Specification

### 1. Audio Recording

**Microphone Recording**
- Platform: macOS, Windows, Linux
- Quality: 48kHz stereo, AAC encoding, 192kbps
- Format: .m4a
- Uses Electron's native audio APIs

**System Audio Recording**
- Platform: macOS only (ScreenCaptureKit framework)
- Captures audio output from telehealth apps (Zoom, Teams, browsers)
- Requires Screen Recording permission
- Quality: Same as microphone

**Future platforms:**
- Windows system audio (WASAPI loopback)
- Linux system audio (PulseAudio monitor)

### 2. Desktop Event Handling

**Critical requirement:** Must not lose audio during system events.

**System Events:**
- Audio device changes (headphones unplugged, new device connected)
- System sleep/wake cycles
- Application window minimize/focus changes
- Low disk space warnings

**Handling strategy:**
```
Device change -> Switch to new default device, continue recording
System sleep -> Pause recording, save state
System wake -> Resume recording from saved state
Low disk space -> Warn user, stop if critical
```

**Implementation:**
- Monitor Electron system events
- Persist recording state to localStorage
- Handle audio device enumeration and changes
- Display clear user notifications for events

### 3. File Management

**Storage:**
- Default: `~/Documents/Bridge/Recordings/`
- User-configurable location
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
  platform: 'macos' | 'windows' | 'linux';
}
```

**Operations:**
- List all recordings (read from disk + metadata)
- Delete recording (file + metadata)
- Query metadata
- Calculate total storage used
- Show in Finder/Explorer (reveal file)

**Persistence:**
- Metadata: localStorage in Electron renderer
- Files: Direct filesystem storage
- Cross-platform paths using Node.js path module

### 4. Permissions

**macOS:**
- Microphone: Standard permission request via Electron
  - Automatic system prompt on first use
  - Entitlements configured in .plist
- Screen Recording: Required for system audio
  - No automatic prompt API available
  - User must manually enable in System Settings > Privacy & Security > Screen Recording
  - App detects permission status and shows instructions

**Windows:**
- Microphone: Windows Privacy settings
- Automatic permission prompt on first recording

**Linux:**
- Microphone: Handled by PulseAudio/ALSA
- Generally permissive, varies by distribution

**Permission flow:**
1. Check permission status via system APIs
2. Request if possible (mic) or guide user (screen recording)
3. Show clear error if denied with instructions
4. Provide buttons to open System Settings

### 5. User Interface

**Minimal design principle:** Function over form, native desktop feel.

**Main Window:**
- Recording mode selector: Microphone / System Audio
- Large record button (red when recording)
- Duration timer (shows elapsed time during recording)
- Permission status indicators
- Available disk space display

**Recordings List View:**
- Table/list view, chronological (newest first)
- Columns: Filename, Duration, Size, Date/Time, Mode
- Actions per recording:
  - Delete button
  - "Show in Finder/Explorer" button
- Total recordings count and total size footer

**Settings Panel:**
- Recording save location picker
- Audio quality settings
- Launch at startup toggle

**No features:**
- Built-in audio playback (use system player)
- Waveform visualization
- Audio editing tools
- Cloud sync or sharing features

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
- Periodically save recording state to disk (every 30 seconds)
- On app restart, check for incomplete recordings
- Offer to recover partial recording or discard

**Storage monitoring:**
- Check available disk space before recording starts
- Warn at < 500MB available
- Block recording at < 100MB available
- Display available storage in UI footer

**System sleep handling:**
- Detect system sleep events via Electron
- Pause recording and save state
- Resume automatically on wake
- Mark recordings that were interrupted

**Data integrity:**
- Flush audio buffer regularly (every 5 seconds)
- Verify file written successfully after stop
- Use atomic file operations
- Handle write errors gracefully

## Project Structure

```
bridge/
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # Main entry point
│   │   ├── ipc-handlers.ts          # IPC communication handlers
│   │   ├── audio/
│   │   │   ├── microphone.ts        # Cross-platform mic recording
│   │   │   └── macos-system.ts      # macOS system audio
│   │   ├── file-manager.ts          # Recording file operations
│   │   └── permissions.ts           # Permission checking
│   │
│   ├── renderer/                    # Electron renderer process
│   │   ├── App.tsx                  # Main React app
│   │   ├── components/
│   │   │   ├── RecordButton.tsx
│   │   │   ├── RecordingTimer.tsx
│   │   │   ├── RecordingsList.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   └── PermissionStatus.tsx
│   │   ├── hooks/
│   │   │   ├── useRecording.ts
│   │   │   ├── usePermissions.ts
│   │   │   └── useRecordingsList.ts
│   │   ├── store/
│   │   │   └── recordingStore.ts    # Zustand state
│   │   ├── types/
│   │   │   └── recording.types.ts
│   │   └── index.html               # Renderer entry point
│   │
│   └── preload.ts                   # Electron preload script
│
├── native-modules/
│   └── screencapturekit/            # macOS native module
│       ├── src/
│       │   ├── binding.cpp          # Node-API bindings
│       │   └── screencapture.mm     # ScreenCaptureKit wrapper
│       ├── binding.gyp              # node-gyp config
│       ├── package.json
│       └── README.md
│
├── docs/
│   └── ARCHITECTURE.md              # Technical architecture
│
├── electron-builder.json            # electron-builder config
├── vite.config.ts                   # Vite bundler config
├── tsconfig.json                    # TypeScript config
├── package.json
└── PLAN.md                          # This file
```

## Implementation Details

### Electron Main Process - Recording Management

```typescript
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';
import { MicrophoneRecorder } from './audio/microphone';
import { MacOSSystemAudioRecorder } from './audio/macos-system';

let currentRecorder: MicrophoneRecorder | MacOSSystemAudioRecorder | null = null;

ipcMain.handle('recording:start', async (event, options: {
  mode: 'microphone' | 'system',
  outputPath: string
}) => {
  const { mode, outputPath } = options;

  if (mode === 'system') {
    if (process.platform !== 'darwin') {
      throw new Error('System audio only supported on macOS');
    }

    const hasPermission = await checkScreenRecordingPermission();
    if (!hasPermission) {
      throw new Error('Screen Recording permission required. Please enable in System Settings.');
    }

    currentRecorder = new MacOSSystemAudioRecorder();
  } else {
    currentRecorder = new MicrophoneRecorder();
  }

  await currentRecorder.start(outputPath);

  return { success: true, startTime: Date.now() };
});

ipcMain.handle('recording:stop', async () => {
  if (!currentRecorder) {
    throw new Error('No active recording');
  }

  const result = await currentRecorder.stop();
  currentRecorder = null;

  return result;
});
```

### macOS System Audio via ScreenCaptureKit

```typescript
// src/main/audio/macos-system.ts
import { screencapturekit } from '../../native-modules/screencapturekit';

export class MacOSSystemAudioRecorder {
  private recording = false;
  private outputPath = '';

  async start(outputPath: string) {
    this.outputPath = outputPath;
    this.recording = true;

    await screencapturekit.startAudioCapture({
      outputPath,
      sampleRate: 48000,
      channels: 2,
      bitrate: 192000,
    });
  }

  async stop() {
    if (!this.recording) return null;

    this.recording = false;
    const stats = await screencapturekit.stopAudioCapture();

    return {
      filePath: this.outputPath,
      duration: stats.duration,
      size: stats.fileSize,
    };
  }
}
```

### React Renderer - Recording Hook

```typescript
// src/renderer/hooks/useRecording.ts
import { useState, useCallback } from 'react';
import { useRecordingStore } from '../store/recordingStore';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const store = useRecordingStore();

  const startRecording = useCallback(async (mode: 'microphone' | 'system') => {
    const timestamp = Date.now();
    const filename = `recording_${formatTimestamp(timestamp)}.m4a`;
    const outputPath = await window.electron.getRecordingPath(filename);

    try {
      await window.electron.recording.start({ mode, outputPath });
      setIsRecording(true);

      // Start duration timer
      const interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      store.setActiveRecording({ filename, startTime: timestamp, mode });

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [store]);

  const stopRecording = useCallback(async () => {
    try {
      const result = await window.electron.recording.stop();
      setIsRecording(false);
      setDuration(0);

      // Save metadata
      await store.saveRecording({
        ...result,
        id: crypto.randomUUID(),
      });

      return result;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, [store]);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
  };
}
```

## Configuration

### package.json

```json
{
  "name": "bridge",
  "version": "1.0.0",
  "description": "Desktop audio recording for telehealth",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win",
    "build:linux": "electron-builder --linux",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "dependencies": {
    "electron": "^32.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### electron-builder.json

```json
{
  "appId": "com.bridge.desktop",
  "productName": "Bridge",
  "directories": {
    "output": "dist",
    "buildResources": "build"
  },
  "mac": {
    "target": ["dmg"],
    "category": "public.app-category.medical",
    "entitlements": "build/entitlements.mac.plist",
    "hardenedRuntime": true,
    "gatekeeperAssess": false
  },
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  "linux": {
    "target": ["AppImage"],
    "category": "Audio"
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
  <key>com.apple.security.device.microphone</key>
  <true/>
</dict>
</plist>
```

### native-modules/screencapturekit/binding.gyp

```python
{
  "targets": [{
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
    "conditions": [
      ["OS=='mac'", {
        "xcode_settings": {
          "OTHER_CFLAGS": ["-ObjC++", "-std=c++17"],
          "MACOSX_DEPLOYMENT_TARGET": "12.3"
        },
        "link_settings": {
          "libraries": [
            "-framework ScreenCaptureKit",
            "-framework AVFoundation",
            "-framework CoreMedia"
          ]
        }
      }]
    ]
  }]
}
```

## Testing Requirements

### System Event Testing (Critical)

**Test matrix:**
1. Record microphone audio for 2 minutes, verify file saved
2. Record system audio (macOS), verify output captured
3. Unplug headphones during recording, verify continues with default device
4. Put system to sleep during recording, wake, verify pause/resume
5. Minimize app window, verify recording continues
6. Record with low storage (< 200MB), verify warning displayed
7. Record with critical storage (< 100MB), verify recording blocked

**Telehealth platform testing (macOS system audio):**
- Zoom desktop client
- Microsoft Teams desktop client
- Google Meet (Chrome/Safari)
- Doxy.me (browser)
- Verify audio captured correctly from each

### Platform Testing

**macOS:**
- macOS 12.3+ (Monterey or later)
- Test on Intel and Apple Silicon Macs
- Multiple display configurations (for screen recording permission)
- Permission flow verification for microphone and screen recording
- System sleep/wake scenarios

**Windows:**
- Windows 10/11
- Microphone recording verification
- Permission handling

**Linux:**
- Ubuntu 22.04+ or equivalent
- Microphone recording verification
- PulseAudio/ALSA compatibility

## Build & Deployment

### Development

```bash
# Install dependencies
pnpm install

# Build native module (macOS only)
cd native-modules/screencapturekit && pnpm rebuild && cd ../..

# Start development server
pnpm dev
```

### Production Builds

**macOS:**
```bash
pnpm build:mac
# Output: dist/Bridge-1.0.0.dmg
# For distribution: Code sign and notarize
```

**Windows:**
```bash
pnpm build:win
# Output: dist/Bridge-Setup-1.0.0.exe
```

**Linux:**
```bash
pnpm build:linux
# Output: dist/Bridge-1.0.0.AppImage
```

## Dependencies

### Main Application

```json
{
  "dependencies": {
    "electron": "^32.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.0.0",
    "electron-builder": "^24.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-electron": "^0.15.0"
  }
}
```

### Native Module (macOS)

```json
{
  "name": "screencapturekit",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "node-addon-api": "^8.0.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  },
  "scripts": {
    "rebuild": "node-gyp rebuild",
    "build": "node-gyp build"
  }
}
```

## Platform Capabilities

**macOS:**
- Microphone and system audio fully supported
- Requires macOS 12.3+ for system audio (ScreenCaptureKit)
- User must manually enable Screen Recording permission
- No automatic permission prompt API for screen recording
- Universal binary (Intel + Apple Silicon)

**Windows:**
- Microphone fully supported
- System audio: Future (WASAPI loopback recording)

**Linux:**
- Microphone fully supported
- System audio: Future (PulseAudio monitor source)
- Varies by distribution and audio subsystem

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

**Version**: 1.0.0
**Project Name**: Bridge
**Last Updated**: 2025-01-13
**Focus**: Electron desktop audio recording for telehealth
**Scope**: Desktop only (macOS/Windows/Linux), no mobile
