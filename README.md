# Recording App

Minimal audio recording application for telehealth sessions. Designed for reliable capture with robust interruption handling.

## Purpose

Record telehealth sessions (Zoom, Teams, browser-based platforms) with confidence that interruptions (phone calls, system alerts) won't lose audio data. Similar to Granola.ai's recording foundation, but minimal: no transcription, no AI, just reliable capture.

## Features

- Microphone recording (iOS and desktop)
- System audio recording (macOS only)
- Interruption handling (pause/resume on phone calls, etc.)
- Background recording (iOS)
- Simple file management
- No playback UI (files accessible via filesystem)

## Architecture

**Monorepo** with 80-90% code sharing:
- **Desktop**: Electron + React Native Web (macOS/Windows/Linux)
- **Mobile**: React Native + Expo (iOS)
- **Shared**: Components, logic, state (Zustand)

## Technology

- React 18.3.x + TypeScript 5.3+
- React Native 0.76.x (iOS)
- Electron 32.x (desktop)
- Expo SDK 54 with expo-audio
- pnpm workspaces + Turborepo

## Prerequisites

**All platforms:**
- Node.js 20+ LTS
- pnpm 8+

**iOS development:**
- macOS with Xcode 15+
- iOS 17+ device or simulator
- EAS CLI: `npm install -g eas-cli`

**Desktop development:**
- macOS 12.3+ (for system audio via ScreenCaptureKit)
- Windows/Linux (microphone only, system audio future)

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd recording-app
pnpm install

# iOS development
cd packages/mobile
pnpm start              # Start Expo
pnpm ios                # Run on simulator

# Desktop development
cd packages/desktop
pnpm dev                # Start Electron

# Build shared package
cd packages/shared
pnpm build
```

## Project Structure

```
recording-app/
├── packages/
│   ├── mobile/          # iOS app (Expo)
│   ├── desktop/         # Electron app
│   └── shared/          # Shared code (80-90%)
├── native-modules/
│   └── electron-screencapturekit/   # macOS system audio
├── docs/
│   ├── ARCHITECTURE.md
│   └── INTERRUPTIONS.md
└── PLAN.md
```

## Usage

### iOS

1. Launch app
2. Grant microphone permission
3. Tap record button
4. Recording continues in background
5. Stop when done
6. Files saved to app documents directory

**Interruptions:**
- Incoming call: Recording pauses, resumes if declined
- Call accepted: Partial recording saved
- Other interruptions: Automatic pause/resume

### Desktop (macOS)

1. Launch app
2. Select mode: Microphone or System Audio
3. For system audio: Grant Screen Recording permission in System Preferences
4. Click record
5. Stop when done
6. Files saved to ~/Documents/Recordings/

**System audio:** Captures output from telehealth apps (Zoom, Teams, browsers)

## Development

### Scripts

**Root:**
```bash
pnpm build          # Build all packages
pnpm dev            # Start all in development mode
pnpm typecheck      # TypeScript check all packages
```

**Mobile:**
```bash
pnpm start          # Expo dev server
pnpm ios            # iOS simulator
pnpm ios --device   # Physical device
```

**Desktop:**
```bash
pnpm dev            # Electron development mode
pnpm build          # Production build
pnpm build:mac      # macOS .dmg
```

**Shared:**
```bash
pnpm build          # Build shared package
pnpm dev            # Watch mode
```

## Building for Production

### iOS

```bash
cd packages/mobile

# Development build
eas build --profile development --platform ios

# Production build
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

### Desktop

```bash
cd packages/desktop

# macOS
pnpm build:mac

# Windows (future)
pnpm build:win

# Linux (future)
pnpm build:linux
```

## Platform Notes

### iOS

- Microphone recording only (system audio impossible on iOS)
- Background recording supported
- Requires iOS 17.0+
- UIBackgroundModes: ["audio"] configured

### macOS

- Microphone and system audio
- System audio requires macOS 12.3+ (ScreenCaptureKit)
- User must manually enable Screen Recording in System Preferences
- No automatic permission request available

### Windows/Linux

- Microphone recording (implemented)
- System audio (future - WASAPI for Windows, PulseAudio for Linux)

## Interruption Handling

### iOS Interruptions

**Types:**
- Phone calls (cellular, FaceTime, VoIP)
- Alarms and timers
- Siri
- Emergency alerts
- Other apps requesting audio

**Behavior:**
- Interruption begins: Recording pauses automatically
- User declines: Recording resumes automatically
- User accepts: Recording stops, partial file saved with metadata

**Implementation:**
- AVAudioSession interruption notifications
- Recording state persisted
- Metadata tracks interruption count

### Testing Requirements

Critical scenarios:
1. Record, receive call, decline, verify continuous
2. Record, receive call, accept, verify partial saved
3. Record, trigger alarm, verify pause/resume
4. Record, background for 5 minutes, verify continues
5. Record with low storage, verify warning

See `docs/INTERRUPTIONS.md` for detailed testing guide.

## File Format

- Format: .m4a (AAC encoding)
- Quality: 48kHz stereo, 192kbps
- Naming: `recording_YYYYMMDD_HHMMSS.m4a`
- Metadata: JSON in AsyncStorage/localStorage

```typescript
interface Recording {
  id: string;
  filename: string;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
  recordingMode: 'microphone' | 'system';
  interrupted: boolean;
  interruptionCount: number;
  platform: 'ios' | 'macos' | 'windows' | 'linux';
}
```

## Storage

**iOS:**
- Location: App documents directory
- Backed up to iCloud (if enabled)
- Accessible via Files app

**Desktop:**
- Location: `~/Documents/Recordings/` (default)
- User-configurable
- Direct filesystem access

## Troubleshooting

### iOS

**"Permission denied"**
- Settings → Privacy & Security → Microphone → Enable for app
- Rebuild app after app.json changes

**"Recording won't resume after call"**
- Check UIBackgroundModes configured
- Verify setAudioModeAsync called with correct options

**"App crashes on recording"**
- Check iOS version (17.0+ required)
- Verify expo-audio installed correctly
- Check Expo SDK version (54+ required, expo-av removed)

### macOS

**"System audio not working"**
- Verify macOS 12.3+
- System Preferences → Privacy & Security → Screen Recording
- Enable permission for app
- Restart app

**"Permission popup doesn't appear"**
- Screen Recording permission has no automatic request
- App must guide user to System Preferences manually

**"Native module build fails"**
- Install Xcode Command Line Tools: `xcode-select --install`
- Install node-gyp: `npm install -g node-gyp`
- Verify binding.gyp configuration

### Monorepo

**"Dependencies not resolving"**
- Run `pnpm install` from root
- Check `pnpm-workspace.yaml`
- Verify workspace protocol: `"@recording-app/shared": "workspace:*"`

**"TypeScript errors in shared package"**
- Build shared first: `cd packages/shared && pnpm build`
- Check tsconfig.json paths configuration

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
- [docs/INTERRUPTIONS.md](./docs/INTERRUPTIONS.md) - Interruption handling guide
- [expo-audio Documentation](https://docs.expo.dev/versions/latest/sdk/audio/)
- [ScreenCaptureKit (Apple)](https://developer.apple.com/documentation/screencapturekit)

## Contributing

1. Create feature branch
2. Make changes (prefer shared code over platform-specific)
3. Test on both iOS and desktop
4. Ensure TypeScript passes strict checks
5. Test interruption scenarios thoroughly
6. Submit pull request

## License

[Your License]

---

**Version**: 1.0.0
**Focus**: Minimal, reliable recording for telehealth
**Last Updated**: 2025-01-05
