# Recording App

A modern, cross-platform audio recording application for macOS and iOS built with React Native and Expo.

## Features

### Current (Phase 1-2)
- 🎤 **Microphone Recording** - High-quality audio recording on iOS and macOS
- 📱 **Cross-Platform** - Single codebase for iOS and macOS
- 💾 **Local Storage** - Recordings saved securely to device
- 🎨 **Modern UI** - Built with React Native and Expo Router

### Planned (Phase 3+)
- 🖥️ **System Audio Capture** (macOS only) - Record audio playing on your Mac
- 📊 **Waveform Visualization** - Real-time audio visualization
- ✂️ **Audio Editing** - Trim, cut, and merge recordings
- ☁️ **Cloud Backup** - Optional cloud storage integration

## Technology Stack

- **Framework**: React Native with Expo SDK 52
- **Language**: TypeScript (strict mode)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **Audio**: expo-audio (modern hooks-based API)
- **Storage**: expo-file-system

## Prerequisites

- **Node.js**: 18.x or later (LTS)
- **npm** or **yarn**
- **iOS Development**:
  - macOS computer
  - Xcode 15+
  - iOS Simulator or physical device (iOS 17+)
- **macOS Development** (for system audio):
  - macOS 14+
  - Xcode 15+

## Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd RecordingApp

# Install dependencies
npm install
```

### 2. Start Development Server

```bash
# Start Expo development server
npx expo start
```

### 3. Run on Device/Simulator

```bash
# iOS Simulator
npx expo run:ios

# Physical iOS device (requires Apple Developer account)
npx expo run:ios --device

# macOS (experimental)
npx expo run:ios --scheme RecordingApp-macOS
```

## Project Structure

```
RecordingApp/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Recording screen
│   │   └── recordings.tsx # Recordings list
│   └── _layout.tsx        # Root layout
├── src/
│   ├── features/          # Feature modules
│   │   └── recording/
│   ├── services/          # Business logic
│   ├── shared/            # Shared components/utils
│   └── types/             # TypeScript types
├── modules/               # Native modules
│   └── system-audio-macos/
└── docs/                  # Documentation
```

See [PLAN.md](./PLAN.md) for detailed architecture.

## Development

### Available Scripts

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android (future)
npm run android

# Type checking
npm run typecheck

# Linting (future)
npm run lint

# Testing (future)
npm test
```

### Environment Setup

**iOS Permissions**:
The app requires microphone access. Permission is requested automatically when you first try to record.

**macOS Permissions** (Phase 3):
For system audio recording, you'll need to grant Screen Recording permission:
1. System Preferences → Privacy & Security → Screen Recording
2. Enable permission for the app

### Building for Production

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## Usage

### Recording Audio

1. **Open the app** - Launch on your iOS device or macOS
2. **Grant permissions** - Allow microphone access when prompted
3. **Tap Record** - Press the record button to start recording
4. **Tap Stop** - Press stop when finished
5. **View recordings** - Navigate to the Recordings tab to see your saved audio

### Managing Recordings

- **Play** - Tap a recording to play it back (Phase 2)
- **Rename** - Edit recording titles (Phase 4)
- **Delete** - Swipe to delete recordings (Phase 2)
- **Share** - Export recordings to other apps (Phase 4)

## Architecture

### Key Design Decisions

**1. Expo over bare React Native**
- Faster development with managed workflow
- Easy over-the-air updates
- Simplified native module integration

**2. Expo Router over React Navigation**
- File-based routing (convention over configuration)
- Automatic deep linking
- Type-safe navigation with TypeScript

**3. Zustand over Redux**
- Minimal boilerplate for simple state needs
- Excellent TypeScript support
- Easier to learn and maintain

**4. expo-audio over expo-av**
- Modern hooks-based API
- Better lifecycle management
- Not deprecated (expo-av is legacy)

### Data Flow

```
User Action (UI)
    ↓
Component/Hook
    ↓
Service Layer (audioService, storageService)
    ↓
Expo APIs (expo-audio, expo-file-system)
    ↓
Native Modules (iOS/macOS)
    ↓
Zustand Store (state update)
    ↓
UI Re-render
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture documentation.

## Platform-Specific Notes

### iOS

**Supported**:
- ✅ Microphone recording
- ✅ Background recording
- ✅ High-quality audio (.m4a)

**Not Supported**:
- ❌ System audio capture (Apple security restriction)
- ❌ Programmatic audio source selection

**Configuration**:
- Requires `NSMicrophoneUsageDescription` in Info.plist
- Background audio requires `UIBackgroundModes: ["audio"]`

### macOS

**Supported** (Phase 1-2):
- ✅ Microphone recording
- ✅ High-quality audio (.m4a)

**Planned** (Phase 3):
- 🔄 System audio capture via ScreenCaptureKit native module
- 🔄 Requires screen recording permission

**Limitations**:
- Expo Go doesn't support custom native modules
- Requires development build for system audio feature
- Less mature ecosystem compared to iOS

## Native Module Development (Phase 3)

For system audio recording on macOS, we'll implement a custom Expo module using ScreenCaptureKit.

**Prerequisites**:
- Swift 5.5+
- macOS 12.3+ SDK
- Expo modules API knowledge

**Implementation Guide**: See [modules/system-audio-macos/README.md](./modules/system-audio-macos/README.md)

## Testing

### Manual Testing
1. Test recording on iOS Simulator
2. Test recording on iOS device
3. Test recording on macOS (Phase 3)
4. Test permissions flow
5. Test file storage and retrieval
6. Test edge cases (interruptions, low storage, etc.)

### Automated Testing (Future)
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

## Troubleshooting

### Common Issues

**"Permission denied" when recording**
- Ensure microphone permission is granted in Settings
- Check Info.plist has NSMicrophoneUsageDescription

**"Module not found" errors**
- Run `npm install` to ensure all dependencies are installed
- Clear Metro bundler cache: `npx expo start --clear`

**Build fails on macOS**
- Ensure Xcode Command Line Tools are installed
- Check macOS deployment target in app.json

**Recording doesn't work in background (iOS)**
- Verify UIBackgroundModes includes "audio" in app.json
- Rebuild the app after configuration changes

### Getting Help

1. Check [PLAN.md](./PLAN.md) for implementation details
2. Review [docs/](./docs/) for architecture and API docs
3. Search [Expo Audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/)
4. Open an issue in the repository

## Contributing

### Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Follow TypeScript strict mode
   - Use path aliases (`@/`, `@features/`, etc.)
   - Update tests if applicable

3. **Test thoroughly**
   - Test on both iOS and macOS
   - Verify permissions flow
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

- **TypeScript**: Strict mode, explicit types
- **File naming**: PascalCase for components, camelCase for utilities
- **Imports**: Use path aliases, group by external/internal
- **Components**: Functional components with hooks
- **Comments**: Explain "why" not "what"

## Roadmap

### Phase 1: Minimal Scaffold ✅
- [x] Project structure
- [x] Configuration files
- [x] Documentation

### Phase 2: Microphone Recording 🚧
- [ ] Audio service implementation
- [ ] Recording UI
- [ ] File storage
- [ ] Playback functionality
- [ ] Recordings list

### Phase 3: macOS System Audio 📅
- [ ] ScreenCaptureKit native module
- [ ] Screen recording permissions
- [ ] Platform detection
- [ ] Build configuration

### Phase 4: Polish & Features 📅
- [ ] Waveform visualization
- [ ] Audio editing
- [ ] Cloud backup
- [ ] Settings screen
- [ ] App Store release

## License

[Your License Here]

## Contact

[Your Contact Information]

---

**Status**: Phase 1 - Planning Complete
**Version**: 0.1.0
**Last Updated**: 2025-01-05
