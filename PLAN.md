# Recording App - Implementation Plan

## Overview
A cross-platform audio recording application for macOS and iOS built with React Native and Expo, supporting microphone recording on both platforms and system audio capture on macOS via native modules.

## Technology Stack

### Core Framework
- **React Native**: 0.76.x
- **Expo SDK**: 52 (latest as of January 2025)
- **TypeScript**: 5.3+ (strict mode)
- **Node**: 18+ LTS

### Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| `expo-audio` | ~14.0.0 | Modern audio recording API (replaces deprecated expo-av) |
| `expo-router` | ~4.0.0 | File-based navigation with typed routes |
| `expo-file-system` | ~18.0.0 | Audio file storage and management |
| `zustand` | ^5.0.0 | Lightweight state management |
| `react-native` | 0.76.5 | Core RN framework with New Architecture |

### Development Tools
- **EAS CLI**: For builds and deployments
- **TypeScript**: Strict mode with path aliases
- **Jest**: Testing framework (future phase)
- **ESLint/Prettier**: Code quality (future phase)

## Platform Support

### iOS (17.0+)
- ✅ Microphone recording via expo-audio
- ✅ Background audio recording (UIBackgroundModes)
- ❌ System audio capture (impossible due to Apple security restrictions)
- ✅ Audio format: .m4a (AAC, HIGH_QUALITY preset)

### macOS (14.0+)
- ✅ Microphone recording via expo-audio
- 🔄 System audio capture via ScreenCaptureKit (Phase 2 - native module)
- ✅ Audio format: .m4a (AAC)
- ⚠️ Requires screen recording permission

## Project Structure

```
RecordingApp/
├── app/                              # Expo Router - File-based routing
│   ├── (tabs)/                       # Tab group
│   │   ├── _layout.tsx              # Tab navigator configuration
│   │   ├── index.tsx                # Home/Recording screen
│   │   └── recordings.tsx           # Recordings library screen
│   ├── _layout.tsx                  # Root layout (providers, theme)
│   └── +not-found.tsx               # 404 fallback
│
├── src/                              # Source code
│   ├── features/                     # Feature modules
│   │   └── recording/
│   │       ├── components/
│   │       │   ├── RecordButton.tsx          # Record/Stop button
│   │       │   ├── RecordingTimer.tsx        # Duration display
│   │       │   └── AudioVisualizer.tsx       # Waveform (future)
│   │       ├── hooks/
│   │       │   ├── useRecording.ts           # Recording logic
│   │       │   └── useAudioPermissions.ts    # Permission handling
│   │       ├── store/
│   │       │   └── recordingStore.ts         # Zustand state
│   │       └── types/
│   │           └── recording.types.ts        # TypeScript types
│   │
│   ├── services/                     # Business logic services
│   │   ├── audioService.ts          # Audio recording wrapper
│   │   └── storageService.ts        # File system operations
│   │
│   ├── shared/                       # Shared resources
│   │   ├── components/              # Reusable UI components
│   │   ├── hooks/                   # Common hooks
│   │   ├── utils/                   # Utility functions
│   │   └── constants/               # App constants
│   │
│   └── types/                        # Global TypeScript types
│       └── index.ts
│
├── modules/                          # Native modules
│   └── system-audio-macos/         # macOS ScreenCaptureKit module
│       ├── ios/                     # Native Swift code (Phase 2)
│       ├── src/                     # JS/TS bridge
│       ├── expo-module.config.json
│       └── README.md               # Implementation guide
│
├── assets/                          # Static assets
│   ├── images/
│   └── fonts/
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md
│   ├── NATIVE_MODULE_GUIDE.md
│   └── API.md
│
├── app.json                         # Expo configuration
├── eas.json                         # EAS Build configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Dependencies
├── .gitignore                       # Git ignore
└── README.md                        # Project documentation
```

## Implementation Phases

### Phase 1: Minimal Scaffold (Current)
**Goal**: Basic project structure with microphone recording

**Deliverables**:
1. Project initialization with Expo SDK 52
2. Folder structure setup
3. Configuration files (app.json, tsconfig.json, eas.json)
4. Basic recording hook using expo-audio
5. Simple UI (RecordButton component)
6. File storage service (stub)
7. Documentation (PLAN.md, README.md, ARCHITECTURE.md)

**Timeline**: 1-2 days

### Phase 2: Microphone Recording Implementation
**Goal**: Fully functional microphone recording on iOS/macOS

**Deliverables**:
1. Complete audioService with expo-audio
2. Permission handling (iOS/macOS)
3. Recording state management (Zustand store)
4. File storage implementation
5. Recording list UI
6. Basic playback functionality
7. Error handling

**Timeline**: 1 week

### Phase 3: macOS System Audio (Native Module)
**Goal**: ScreenCaptureKit integration for macOS system audio

**Deliverables**:
1. Expo native module setup
2. Swift implementation using ScreenCaptureKit
3. React Native bridge (JSI/TurboModules)
4. Screen recording permission flow
5. Platform detection and fallback logic
6. Build configuration for native module
7. Testing on macOS

**Timeline**: 2-3 weeks

### Phase 4: Polish & Features
**Goal**: Production-ready app

**Deliverables**:
1. Audio waveform visualization
2. Recording editing (trim, rename, etc.)
3. Export/share functionality
4. Settings screen
5. Comprehensive testing
6. App icons and splash screens
7. App Store preparation

**Timeline**: 2-3 weeks

## Technical Architecture

### Audio Recording Flow

#### Microphone Recording (iOS/macOS - Phase 1-2)
```
User taps Record
    ↓
Check microphone permission
    ↓
Request if not granted
    ↓
Configure audio mode (setAudioModeAsync)
    ↓
Initialize recorder (useAudioRecorder hook)
    ↓
prepareToRecordAsync() → record()
    ↓
Monitor recording state (useAudioRecorderState)
    ↓
User taps Stop → stop()
    ↓
Get recording URI
    ↓
Save to document directory (FileSystem.moveAsync)
    ↓
Add to Zustand store
    ↓
Update UI
```

#### System Audio Recording (macOS - Phase 3)
```
User selects "System Audio" mode
    ↓
Check screen recording permission (macOS)
    ↓
Request if not granted (System Preferences)
    ↓
Initialize ScreenCaptureKit native module
    ↓
Configure capture (audio only, specific app/window/display)
    ↓
Start capture stream
    ↓
Bridge audio data to JS
    ↓
Write to file
    ↓
Stop capture → save file
    ↓
Add to Zustand store
```

### State Management Strategy

#### Zustand Store Structure
```typescript
interface RecordingStore {
  // State
  recordings: Recording[];
  currentRecording: Recording | null;
  isRecording: boolean;
  recordingMode: 'microphone' | 'system'; // Phase 3

  // Actions
  addRecording: (recording: Recording) => void;
  removeRecording: (id: string) => void;
  updateRecording: (id: string, data: Partial<Recording>) => void;
  setCurrentRecording: (recording: Recording | null) => void;
  setRecordingMode: (mode: 'microphone' | 'system') => void;

  // Async actions
  loadRecordings: () => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
}
```

### File Storage Strategy

**Location**: `FileSystem.documentDirectory + 'recordings/'`

**Naming Convention**: `recording_${timestamp}_${uuid}.m4a`

**Metadata**: Stored in Zustand + AsyncStorage for persistence
```typescript
interface Recording {
  id: string;
  filename: string;
  title: string; // User-editable
  duration: number; // seconds
  size: number; // bytes
  createdAt: number; // timestamp
  recordingMode: 'microphone' | 'system';
  uri: string;
}
```

## Configuration Details

### app.json
```json
{
  "expo": {
    "name": "Recording App",
    "slug": "recording-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "platforms": ["ios", "android"],
    "experiments": {
      "typedRoutes": true
    },
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "This app needs microphone access to record audio."
        }
      ],
      "expo-router"
    ],
    "ios": {
      "bundleIdentifier": "com.yourcompany.recordingapp",
      "supportsTablet": true,
      "deploymentTarget": "17.0",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "We need microphone access for audio recording.",
        "UIBackgroundModes": ["audio"]
      }
    },
    "android": {
      "package": "com.yourcompany.recordingapp",
      "permissions": ["android.permission.RECORD_AUDIO"]
    }
  }
}
```

### tsconfig.json
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "target": "esnext",
    "module": "commonjs",
    "jsx": "react-native",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@services/*": ["src/services/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### eas.json
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

## Native Module Implementation (Phase 3)

### ScreenCaptureKit Integration

**Requirements**:
- macOS 12.3+ (ScreenCaptureKit availability)
- Swift 5.5+
- Xcode 13+

**Key APIs**:
- `SCContentSharingPicker` - User selects content to capture
- `SCStreamConfiguration` - Configure audio capture settings
- `SCStream` - Capture stream
- `SCStreamOutput` - Receive audio samples

**Module Structure**:
```swift
// modules/system-audio-macos/ios/SystemAudioMacOS.swift
@objc(SystemAudioMacOS)
class SystemAudioMacOS: Module {
  @objc
  func startSystemAudioCapture(options: [String: Any]) -> Promise {
    // ScreenCaptureKit implementation
  }

  @objc
  func stopSystemAudioCapture() -> Promise {
    // Stop capture, return file URI
  }
}
```

**Permissions**:
- Screen Recording permission (System Preferences > Privacy & Security)
- No automatic permission request API - user must enable manually
- App should detect and guide user to settings

## Dependencies

### Production Dependencies
```json
{
  "expo": "~52.0.0",
  "expo-audio": "~14.0.0",
  "expo-router": "~4.0.0",
  "expo-file-system": "~18.0.0",
  "expo-status-bar": "~2.0.0",
  "react": "18.3.1",
  "react-native": "0.76.5",
  "react-native-safe-area-context": "4.12.0",
  "react-native-screens": "~4.3.0",
  "zustand": "^5.0.0"
}
```

### Development Dependencies
```json
{
  "@types/react": "~18.3.12",
  "typescript": "^5.3.0",
  "@expo/config-plugins": "~9.0.0"
}
```

## Security & Privacy Considerations

### Permissions
- Request microphone permission before recording
- Explain permission usage clearly to users
- Handle permission denials gracefully
- Provide settings link if permission denied

### Data Storage
- Recordings stored locally in app sandbox
- No cloud upload without explicit user action
- Secure file deletion (overwrite before delete in future)
- Respect user privacy

### macOS System Audio
- User must explicitly grant screen recording permission
- Clear indication when system audio is being captured
- Recording indicator in app UI
- Option to disable system audio capture

## Testing Strategy (Future Phases)

### Unit Tests
- Audio service functions
- File storage operations
- State management (Zustand)
- Utility functions

### Integration Tests
- Recording flow end-to-end
- File creation and retrieval
- Permission handling

### Platform Tests
- iOS microphone recording
- macOS microphone recording
- macOS system audio (native module)

## Build & Deployment

### Development Builds
```bash
# iOS Simulator
eas build --profile development --platform ios --local

# macOS (future - requires native module)
eas build --profile development --platform ios --local
```

### Production Builds
```bash
# iOS
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

## Known Limitations

### iOS
- ❌ System audio capture impossible (Apple security restriction)
- ❌ Cannot select specific audio input source programmatically
- ⚠️ Background recording requires UIBackgroundModes configuration
- ⚠️ DRM-protected content cannot be recorded (system enforcement)

### macOS
- ⚠️ System audio requires native module (ScreenCaptureKit)
- ⚠️ User must manually enable screen recording permission
- ⚠️ Expo Go not supported with native module (requires development build)
- ⚠️ macOS support in Expo is less mature than iOS

### Cross-Platform
- Different audio formats on iOS (.m4a) vs Android (.3gp with LOW_QUALITY)
- Permission models differ across platforms
- Audio session management complexity

## Future Enhancements

### v2.0 Features
- Real-time audio waveform visualization
- Audio editing (trim, cut, merge)
- Audio effects (noise reduction, normalization)
- Cloud backup integration
- Transcription (Whisper integration)

### v3.0 Features
- Multi-track recording
- Audio mixing
- Live streaming
- Collaboration features

## Resources & References

### Documentation
- [Expo Audio Docs](https://docs.expo.dev/versions/latest/sdk/audio/)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [ScreenCaptureKit Apple Docs](https://developer.apple.com/documentation/screencapturekit)
- [Zustand GitHub](https://github.com/pmndrs/zustand)

### Example Projects
- [Expo Audio Example](https://github.com/expo/expo/tree/main/apps/expo-go/src/screens/Audio)
- [ScreenCaptureKit Sample](https://developer.apple.com/documentation/screencapturekit/capturing_screen_content_in_macos)

## Success Metrics

### Phase 1 (Minimal Scaffold)
- ✅ Project runs on iOS simulator
- ✅ Basic folder structure in place
- ✅ Configuration files created
- ✅ Documentation complete

### Phase 2 (Microphone Recording)
- ✅ Successful microphone recording on iOS/macOS
- ✅ Recordings saved and listed
- ✅ Permissions handled correctly
- ✅ No crashes during recording

### Phase 3 (System Audio)
- ✅ ScreenCaptureKit module builds successfully
- ✅ System audio captured on macOS
- ✅ Permission flow works
- ✅ Falls back to microphone on iOS

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ScreenCaptureKit complexity | High | Medium | Start with microphone-only MVP |
| macOS permission UX | Medium | High | Clear user guidance, documentation |
| Expo SDK breaking changes | Medium | Low | Pin SDK versions, test updates |
| Native module maintenance | High | Medium | Good documentation, modular design |
| App Store rejection | High | Low | Follow guidelines, clear privacy policy |

## Development Workflow

### Setup
1. Clone repository
2. `npm install`
3. `npx expo prebuild` (if using development build)
4. `npx expo start`

### Development
1. Create feature branch
2. Implement changes
3. Test on simulator/device
4. Update documentation
5. Create pull request

### Release
1. Update version in app.json
2. Update changelog
3. Create EAS build
4. Test production build
5. Submit to App Store

---

**Document Version**: 1.0
**Last Updated**: 2025-01-05
**Status**: Phase 1 - Planning Complete
