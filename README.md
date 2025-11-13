# Bridge - Desktop Audio Recording App

Electron-based audio recording application for telehealth sessions. Designed for reliable capture with system audio support on macOS.

## Purpose

Record telehealth sessions (Zoom, Teams, browser-based platforms) on desktop. Capture both microphone input and system audio (macOS). Minimal scope: reliable recording only, no transcription, no AI, just solid audio capture.

## Features

- Microphone recording (macOS/Windows/Linux)
- System audio recording (macOS only via ScreenCaptureKit)
- Simple file management
- No playback UI (files accessible via filesystem)
- Cross-platform desktop support

## Technology

- Electron 32.x
- React 18.3.x + TypeScript 5.3+
- React Native Web 0.19.x
- Zustand (state management)
- Vite (bundler)
- npm

## Prerequisites

**All platforms:**
- Node.js 20+ LTS
- npm (comes with Node.js)

**macOS-specific (for system audio):**
- macOS 12.3+ (Monterey or later)
- Xcode Command Line Tools: `xcode-select --install`
- node-gyp for native module compilation: `npm install -g node-gyp`
- Screen Recording permission (granted manually in System Settings)

**Windows/Linux:**
- Microphone recording supported
- System audio support: future (WASAPI for Windows, PulseAudio for Linux)

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd bridge
npm install

# Development
npm run dev             # Start Electron in development mode

# Build for production
npm run build           # Production build
npm run build:mac       # macOS .dmg
npm run build:win       # Windows installer (future)
npm run build:linux     # Linux package (future)
```

### macOS System Audio Setup

To enable system audio recording on macOS:

1. Build and run the app once
2. Attempt to start a system audio recording
3. Open **System Settings** > **Privacy & Security** > **Screen Recording**
4. Enable permission for Bridge
5. Restart the app
6. System audio recording will now work

Note: macOS requires Screen Recording permission to capture system audio. There is no automatic permission prompt API - users must manually enable it in System Settings.

## Project Structure

```
bridge/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts
│   │   └── audio/
│   │       └── macos-capture.ts # ScreenCaptureKit integration
│   ├── renderer/                # Electron renderer process
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── RecordButton.tsx
│   │   │   ├── RecordingTimer.tsx
│   │   │   └── RecordingsList.tsx
│   │   ├── hooks/
│   │   │   ├── useRecording.ts
│   │   │   └── usePermissions.ts
│   │   └── store/
│   │       └── recordingStore.ts  # Zustand state
│   └── preload.ts               # Electron preload script
├── native-modules/
│   └── screencapturekit/        # Native Node.js addon for macOS
│       ├── src/
│       │   ├── binding.cpp
│       │   └── screencapture.mm
│       └── binding.gyp
├── docs/
│   └── ARCHITECTURE.md
└── PLAN.md
```

## Usage

### Desktop

1. Launch Bridge
2. Select recording mode:
   - **Microphone**: Records input from your microphone
   - **System Audio** (macOS only): Records output from your computer (what you hear)
3. For system audio: Ensure Screen Recording permission is enabled (see macOS System Audio Setup above)
4. Click record button
5. Recording runs in foreground; minimize window to continue recording
6. Click stop when done
7. Files saved to `~/Documents/Bridge/Recordings/`

**System audio (macOS):** Captures output from telehealth apps (Zoom, Teams, Google Meet, etc.)

**Storage location:** Recordings are saved with timestamp filenames: `recording_YYYYMMDD_HHMMSS.m4a`

## Development

### Scripts

```bash
npm run dev         # Start Electron in development mode with hot reload
npm run build       # Production build
npm run build:mac   # Build macOS .dmg installer
npm run build:win   # Build Windows installer (future)
npm run build:linux # Build Linux package (future)
npm run typecheck   # Run TypeScript type checking
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
```

### Native Module Development (macOS)

If you're working on the ScreenCaptureKit native module:

```bash
cd native-modules/screencapturekit

# Rebuild after C++/Objective-C changes
npm rebuild

# Or use node-gyp directly
node-gyp rebuild
```

## Building for Production

### macOS

```bash
# Build .dmg installer
npm run build:mac

# Output: dist/Bridge-1.0.0.dmg
# Installer includes code signing (if certificates configured)
# Distribution: Direct download or Mac App Store submission
```

**Code signing (optional):**
- Configure signing certificate in `electron-builder.json`
- Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables
- Required for notarization and Mac App Store

### Windows (future)

```bash
npm run build:win
# Output: dist/Bridge-Setup-1.0.0.exe
```

### Linux (future)

```bash
npm run build:linux
# Output: dist/Bridge-1.0.0.AppImage
```

## Platform Notes

### macOS

- **Microphone**: Standard audio input, works on all macOS versions
- **System audio**: Requires macOS 12.3+ (ScreenCaptureKit framework)
- **Permission**: Screen Recording permission required for system audio
  - No automatic prompt API exists
  - User must manually enable in System Settings > Privacy & Security > Screen Recording
  - App detects permission status and guides user
- **Architecture**: Supports both Intel and Apple Silicon (universal build)

### Windows

- **Microphone**: Standard audio input supported
- **System audio**: Planned (WASAPI loopback recording)
- **Permission**: Microphone permission handled by Windows

### Linux

- **Microphone**: Standard audio input supported
- **System audio**: Planned (PulseAudio monitor source)
- **Permission**: Handled by distribution-specific mechanisms

## Error Handling

### Desktop Interruptions

**System events handled:**
- Audio device changes (unplugged headphones, etc.)
- System sleep/wake
- Low disk space
- App window minimize/maximize

**Behavior:**
- Device changes: Recording continues with new default device
- System sleep: Recording pauses, resumes on wake
- Low disk space: Warning at <500MB, blocked at <100MB
- Window state: Recording continues regardless of window state

## File Format

- Format: .m4a (AAC encoding)
- Quality: 48kHz stereo, 192kbps
- Naming: `recording_YYYYMMDD_HHMMSS.m4a`
- Metadata: JSON in localStorage

```typescript
interface Recording {
  id: string;
  filename: string;
  startTime: number;          // Unix timestamp
  endTime: number;
  duration: number;           // seconds
  size: number;               // bytes
  recordingMode: 'microphone' | 'system';
  platform: 'macos' | 'windows' | 'linux';
}
```

## Storage

**Default location:** `~/Documents/Bridge/Recordings/`

- User-configurable in settings
- Direct filesystem access
- Compatible with all audio players
- No cloud sync (local storage only)

## Troubleshooting

### macOS

**"System audio not working"**
- Verify macOS 12.3 or later: `sw_vers`
- Open System Settings → Privacy & Security → Screen Recording
- Enable permission for Bridge
- Restart app after enabling permission

**"Permission dialog doesn't appear"**
- Screen Recording permission has no automatic prompt API
- App will show instructions to manually enable in System Settings

**"Native module build fails"**
- Install Xcode Command Line Tools: `xcode-select --install`
- Install node-gyp globally: `npm install -g node-gyp`
- Verify Python is installed (required by node-gyp)
- Check binding.gyp configuration in `native-modules/screencapturekit/`

**"App won't launch after build"**
- Check Console.app for crash logs
- Verify all dependencies installed: `npm install`
- Try clean rebuild: `rm -rf node_modules dist && npm install && npm run build`

### Windows

**"Microphone not detected"**
- Check Windows sound settings: Settings → System → Sound
- Verify microphone enabled and set as default input
- Grant microphone permission in Windows Privacy settings

### General

**"Dependencies not resolving"**
- Run `npm install` from root directory
- Clear npm cache: `npm cache clean --force`
- Verify Node.js version: `node --version` (should be 20+)

**"TypeScript errors"**
- Run type check: `npm run typecheck`
- Verify tsconfig.json configuration
- Check for missing type definitions

## Out of Scope

The following are explicitly not included:

- Playback UI (use OS file manager)
- Transcription
- AI features
- Note taking
- Export/share UI
- Cloud storage
- Waveform visualization
- Audio editing

Files are accessible via filesystem for manual handling.

## Resources

- [PLAN.md](./PLAN.md) - Complete implementation specification
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Technical architecture
- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [ScreenCaptureKit (Apple)](https://developer.apple.com/documentation/screencapturekit)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)

## Contributing

1. Create feature branch from `main`
2. Make changes
3. Test on target platforms (macOS, Windows, Linux)
4. Ensure TypeScript passes strict checks: `npm run typecheck`
5. Format code: `npm run format`
6. Submit pull request

## License

[Your License]

---

**Version**: 1.0.0
**Project Name**: Bridge
**Focus**: Desktop audio recording for telehealth
**Last Updated**: 2025-01-13
