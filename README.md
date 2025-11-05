# Recording App

A modern, cross-platform audio recording application supporting **microphone recording** on iOS and desktop, plus **system audio capture** on macOS.

## Architecture

- **Desktop (macOS/Windows/Linux)**: Electron + React Native Web
- **Mobile (iOS)**: React Native + Expo
- **Code Sharing**: ~80-90% shared codebase via React Native Web
- **Monorepo**: Managed with pnpm workspaces + Turborepo

## Features

### Current Features (Phase 1-2)
- 🎤 **Microphone Recording** - High-quality audio recording on iOS and desktop
- 📱 **iOS App** - Native iOS app with Expo
- 🖥️ **Desktop App** - Electron app for macOS/Windows/Linux
- 💾 **Local Storage** - Recordings saved securely to device
- 🔄 **Shared Codebase** - 80-90% code reuse across platforms

### Planned Features (Phase 3-4)
- 🎧 **System Audio Capture** (macOS) - Record audio playing on your Mac
- 📊 **Waveform Visualization** - Real-time audio visualization
- ✂️ **Audio Editing** - Trim, cut, and merge recordings
- ☁️ **Cloud Backup** - Optional cloud storage integration

## Technology Stack

### Core Technologies
- **React Native**: 0.76.x (iOS)
- **React Native Web**: 0.19.x (Electron renderer)
- **Electron**: 32.x (Desktop wrapper)
- **Expo SDK**: 54 (iOS, expo-av removed)
- **TypeScript**: 5.3+ (strict mode)
- **Node.js**: 20+ LTS

### Key Libraries
- **expo-audio**: Modern audio recording API for iOS (replaces deprecated expo-av)
- **Zustand**: Lightweight state management
- **Vite**: Fast bundler for Electron renderer
- **Turborepo**: Monorepo build system

## Prerequisites

### All Platforms
- **Node.js**: 20.x or later (LTS)
- **pnpm**: 8.x or later (`npm install -g pnpm`)

### iOS Development
- **macOS**: Required for iOS development
- **Xcode**: 15+ with Command Line Tools
- **iOS Simulator** or physical device (iOS 17+)
- **EAS CLI**: `npm install -g eas-cli`

### Desktop Development
- **macOS**: For building macOS apps
- **Windows**: For building Windows apps (future)
- **Linux**: For building Linux apps (future)

## Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd recording-app

# Install dependencies (all packages)
pnpm install
```

### 2. Development

#### iOS Development
```bash
# Start iOS app (Expo)
cd packages/mobile
pnpm start

# Run on iOS Simulator
pnpm ios

# Run on physical device
pnpm ios --device
```

#### Desktop Development
```bash
# Start Electron app
cd packages/desktop
pnpm dev

# Build for production
pnpm build
```

#### Shared Package Development
```bash
# Watch mode for shared code
cd packages/shared
pnpm dev
```

### 3. Build for Production

#### iOS Production Build
```bash
cd packages/mobile

# Create development build
eas build --profile development --platform ios

# Create production build
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

#### Desktop Production Build
```bash
cd packages/desktop

# Build for macOS (creates .dmg and .zip)
pnpm build:mac

# Build for specific architecture
pnpm build:mac:arm64  # Apple Silicon
pnpm build:mac:x64    # Intel Mac

# Build for Windows (future)
pnpm build:win

# Build for Linux (future)
pnpm build:linux
```

## Project Structure

```
recording-app/                         # Monorepo root
├── packages/
│   ├── mobile/                        # iOS app (React Native + Expo)
│   │   ├── app/                       # Expo Router pages
│   │   ├── app.json                   # Expo configuration
│   │   └── package.json
│   │
│   ├── desktop/                       # Desktop app (Electron)
│   │   ├── src/
│   │   │   ├── main/                  # Electron main process
│   │   │   ├── renderer/              # Electron renderer (React)
│   │   │   └── preload.ts             # Preload script
│   │   ├── electron-builder.json      # Packaging config
│   │   └── package.json
│   │
│   └── shared/                        # Shared code (80-90% of app!)
│       ├── src/
│       │   ├── features/              # Feature modules
│       │   ├── components/            # Shared UI components
│       │   ├── services/              # Business logic
│       │   └── utils/                 # Utilities
│       └── package.json
│
├── native-modules/                    # Native code
│   └── electron-screencapturekit/     # macOS system audio (Node.js addon)
│       ├── src/screencapture.mm       # Objective-C++ implementation
│       ├── binding.gyp                # Node-GYP config
│       └── package.json
│
├── docs/                              # Documentation
│   ├── PLAN_REVISED.md                # Implementation plan
│   ├── ARCHITECTURE.md                # Technical architecture
│   └── ELECTRON_SETUP.md              # Electron setup guide
│
├── package.json                       # Root package.json
├── pnpm-workspace.yaml                # PNPM workspaces config
└── turbo.json                         # Turborepo config
```

## Platform-Specific Notes

### iOS

**Supported:**
- ✅ Microphone recording via expo-audio
- ✅ Background recording (UIBackgroundModes)
- ✅ High-quality audio (.m4a AAC format)
- ✅ iOS 17.0+

**Not Supported:**
- ❌ System audio capture (Apple security restriction)
- ❌ Audio input source selection

**Required Permissions:**
- Microphone access (NSMicrophoneUsageDescription)
- Background audio (UIBackgroundModes: ["audio"])

**Important:** expo-av is deprecated. Use expo-audio instead (SDK 54+).

### macOS Desktop

**Supported:**
- ✅ Microphone recording via Web Audio API
- ✅ System audio capture via ScreenCaptureKit (Phase 3)
- ✅ macOS 12.3+ (ScreenCaptureKit requirement)
- ✅ Audio formats: .m4a, .webm

**Requirements:**
- Screen Recording permission (for system audio)
- Microphone permission (for mic recording)
- macOS 12.3+ for system audio capture

**Limitations:**
- User must manually enable Screen Recording in System Preferences
- Cannot capture DRM-protected audio

### Windows Desktop (Future)

**Planned:**
- Microphone recording via Web Audio API
- System audio capture via WASAPI
- Audio formats: .webm, .mp3

### Linux Desktop (Future)

**Planned:**
- Microphone recording via Web Audio API
- System audio capture via PulseAudio
- Audio formats: .webm, .ogg

## Usage

### Recording Audio (iOS)

1. **Open the app** on your iOS device
2. **Grant microphone permission** when prompted
3. **Tap the red Record button** to start recording
4. **Tap Stop** when finished
5. **View your recordings** in the Recordings tab

### Recording Audio (Desktop)

1. **Launch the Electron app**
2. **Choose recording mode:**
   - Microphone: Records from your mic
   - System Audio (macOS only): Records audio playing on your computer
3. **For system audio:** Grant Screen Recording permission in System Preferences
4. **Click Record** to start
5. **Click Stop** when done
6. **Recordings appear in your library**

## Development

### Available Scripts

#### Root (Monorepo)
```bash
pnpm install           # Install all dependencies
pnpm build             # Build all packages
pnpm dev               # Start all packages in dev mode
pnpm test              # Run all tests
pnpm lint              # Lint all packages
pnpm typecheck         # TypeScript check all packages
```

#### Mobile Package
```bash
pnpm start             # Start Expo dev server
pnpm ios               # Run on iOS
pnpm build:ios         # Build with EAS
```

#### Desktop Package
```bash
pnpm dev               # Start Electron in dev mode
pnpm build             # Build for production
pnpm build:mac         # Build macOS app
pnpm package           # Package with electron-builder
```

#### Shared Package
```bash
pnpm dev               # Watch mode for development
pnpm build             # Build shared package
pnpm test              # Run tests
```

### Code Sharing Strategy

The shared package contains platform-agnostic code that works on both iOS and Electron:

**What's Shared (80-90%):**
- ✅ UI Components (React Native components)
- ✅ Business Logic (services, utils)
- ✅ State Management (Zustand stores)
- ✅ Type Definitions (TypeScript types)
- ✅ Hooks (custom React hooks)

**What's Platform-Specific:**
- 📱 iOS: expo-audio integration, native permissions
- 🖥️ Desktop: Electron IPC, Node.js native addons
- 🎧 macOS: ScreenCaptureKit native module

### Platform Detection

The shared package uses platform detection utilities:

```typescript
import { isElectron, isIOS, isMacOS } from '@recording-app/shared/utils/platform';

if (isElectron()) {
  // Desktop-specific code
} else if (isIOS()) {
  // iOS-specific code
}
```

## Architecture Highlights

### Electron + React Native Web

The desktop app uses **React Native Web** to render React Native components in Electron. This means:

1. **Write once, run everywhere**: Same components work on iOS and desktop
2. **Native performance**: Electron provides access to native APIs
3. **Familiar stack**: React/TypeScript everywhere

### Monorepo Benefits

1. **Shared dependencies**: Install once, use everywhere
2. **Type safety**: Shared types across packages
3. **Atomic changes**: Change shared code, rebuild everything
4. **Efficient CI/CD**: Turborepo caching

### Audio Architecture

```
┌─────────────────────────────────────┐
│      Shared Audio Service           │  ← Platform-agnostic API
└─────────────┬───────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐         ┌───▼─────┐
│  iOS   │         │ Desktop │
│ expo-  │         │ Electron│
│ audio  │         │ IPC +   │
│        │         │ Native  │
│        │         │ Addon   │
└────────┘         └─────────┘
```

## Troubleshooting

### iOS Issues

**"Permission denied" when recording**
- Ensure microphone permission is granted in Settings → Privacy → Microphone
- Check `app.json` has `microphonePermission` configured
- Rebuild the app after changing permissions

**"Module not found: expo-audio"**
- Run `npx expo install expo-audio`
- Ensure you're using Expo SDK 54+ (expo-av is removed)
- Clear cache: `npx expo start --clear`

**Build fails with EAS**
- Check Expo account is configured: `eas whoami`
- Verify `eas.json` configuration
- Review build logs on Expo dashboard

### Desktop Issues

**Electron app won't launch**
- Check Node.js version: `node --version` (should be 20+)
- Rebuild native modules: `cd packages/desktop && pnpm rebuild`
- Check for port conflicts (Vite dev server uses port 5173)

**System audio not working (macOS)**
- Verify Screen Recording permission is enabled:
  System Preferences → Privacy & Security → Screen Recording
- Check macOS version (12.3+ required for ScreenCaptureKit)
- Review native module build logs

**Native module build fails**
- Install Xcode Command Line Tools: `xcode-select --install`
- Verify node-gyp is installed: `npm install -g node-gyp`
- Check binding.gyp configuration

### Monorepo Issues

**Dependencies not resolving**
- Run `pnpm install` from root directory
- Check `pnpm-workspace.yaml` configuration
- Ensure workspace protocol is used: `"@recording-app/shared": "workspace:*"`

**TypeScript errors in shared package**
- Build shared package first: `cd packages/shared && pnpm build`
- Check tsconfig.json `paths` configuration
- Verify all packages have TypeScript installed

## Testing

### Unit Tests
```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/shared && pnpm test

# Watch mode
pnpm test --watch
```

### E2E Tests (Future)
```bash
# iOS E2E
cd packages/mobile && pnpm test:e2e

# Desktop E2E
cd packages/desktop && pnpm test:e2e
```

## Contributing

### Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Prefer shared code over platform-specific
   - Follow TypeScript strict mode
   - Use path aliases (`@recording-app/shared`)

3. **Test thoroughly**
   - Test on both iOS and desktop
   - Verify shared components work on both platforms
   - Check edge cases

4. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode, explicit types, no `any`
- **File naming**: PascalCase for components, camelCase for utilities
- **Imports**: Use path aliases, group by external/internal
- **Components**: Functional components with hooks
- **Platform-specific code**: Isolate in services, not components

## Roadmap

### Phase 1: Setup & Scaffolding ✅
- [x] Monorepo structure
- [x] Shared package with basic UI
- [ ] iOS microphone recording
- [ ] Electron app shell

### Phase 2: Core Features 🚧
- [ ] File storage (cross-platform)
- [ ] Recordings list
- [ ] Audio playback
- [ ] State management (Zustand)
- [ ] Delete recordings

### Phase 3: macOS System Audio 📅
- [ ] ScreenCaptureKit Node.js addon
- [ ] Permission handling
- [ ] Source selection (display/window/app)
- [ ] macOS system audio capture

### Phase 4: Polish & Features 📅
- [ ] Waveform visualization
- [ ] Audio editing (trim, cut)
- [ ] Export/share functionality
- [ ] Settings screen
- [ ] App icons and branding
- [ ] App Store / distribution

### Future Enhancements 🔮
- [ ] Windows system audio (WASAPI)
- [ ] Linux system audio (PulseAudio)
- [ ] Cloud sync
- [ ] Audio transcription
- [ ] Multi-track recording

## Resources

### Documentation
- [Expo Audio Docs (Official)](https://docs.expo.dev/versions/latest/sdk/audio/)
- [Expo Audio Recording Example](https://github.com/expo/audio-recording-example)
- [React Native Web](https://necolas.github.io/react-native-web/)
- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [ScreenCaptureKit (Apple)](https://developer.apple.com/documentation/screencapturekit)

### Internal Docs
- [PLAN_REVISED.md](./PLAN_REVISED.md) - Complete implementation plan
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Technical architecture
- [ELECTRON_SETUP.md](./docs/ELECTRON_SETUP.md) - Electron setup guide

## License

[Your License Here]

## Contact

[Your Contact Information]

---

**Version**: 0.1.0 (Alpha)
**Architecture**: Electron + React Native Web (Desktop) + Expo (iOS)
**Status**: Phase 1 - Setup & Scaffolding
**Last Updated**: 2025-01-05
