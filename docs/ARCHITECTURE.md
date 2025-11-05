# Architecture Documentation

## Overview

This document describes the technical architecture of the Recording App, a cross-platform audio recording application built with React Native and Expo.

## Architecture Principles

### 1. Feature-Based Organization
Code is organized by feature rather than by technical layer. Each feature contains its own components, hooks, stores, and types.

**Benefits**:
- Better code locality
- Easier to understand feature scope
- Simpler to add/remove features
- Reduces merge conflicts

### 2. Separation of Concerns
Clear boundaries between UI, business logic, and data access layers.

```
UI Layer (Components)
    ↓
Logic Layer (Hooks, Services)
    ↓
Data Layer (Stores, APIs)
    ↓
Platform Layer (Native Modules)
```

### 3. Platform Abstraction
Platform-specific code is isolated in services, with a unified API exposed to the application.

### 4. Type Safety
Strict TypeScript with explicit types throughout the codebase. No `any` types allowed except where absolutely necessary.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Screens │  │Components│  │  Expo Router         │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Business Logic Layer                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Hooks   │  │  Stores  │  │     Services         │  │
│  │ (Custom) │  │(Zustand) │  │ (Audio, Storage)     │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Platform Layer                        │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │expo-audio  │  │expo-file-  │  │  Native Module  │   │
│  │            │  │  system    │  │  (macOS only)   │   │
│  └────────────┘  └────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                     Native Layer                        │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │iOS AVAudio │  │iOS File    │  │ScreenCaptureKit │   │
│  │Foundation  │  │System      │  │   (macOS)       │   │
│  └────────────┘  └────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Layer Details

### 1. UI Layer

#### Expo Router Structure
File-based routing system that maps file structure to routes.

```
app/
├── _layout.tsx                 # Root layout (providers, theme)
├── (tabs)/                     # Tab group
│   ├── _layout.tsx            # Tab configuration
│   ├── index.tsx              # /              (Recording screen)
│   └── recordings.tsx         # /recordings    (Recordings list)
└── +not-found.tsx             # 404 fallback
```

**Key Features**:
- Automatic deep linking
- Type-safe navigation with generated types
- Shared layouts
- Platform-specific files (`.ios.tsx`, `.macos.tsx`)

#### Component Hierarchy

```
App
├── RootLayout (_layout.tsx)
│   ├── Providers (Zustand, Theme, etc.)
│   └── TabLayout ((tabs)/_layout.tsx)
│       ├── RecordingScreen (index.tsx)
│       │   ├── RecordButton
│       │   ├── RecordingTimer
│       │   └── AudioVisualizer
│       └── RecordingsScreen (recordings.tsx)
│           ├── RecordingsList
│           │   └── RecordingItem
│           └── EmptyState
```

#### Component Patterns

**1. Container/Presentational Pattern**
```typescript
// Container component (with logic)
export default function RecordingScreen() {
  const { startRecording, stopRecording, isRecording } = useRecording();

  return (
    <RecordingView
      onRecord={startRecording}
      onStop={stopRecording}
      isRecording={isRecording}
    />
  );
}

// Presentational component (pure UI)
function RecordingView({ onRecord, onStop, isRecording }) {
  return (
    <View>
      <RecordButton
        onPress={isRecording ? onStop : onRecord}
        isRecording={isRecording}
      />
    </View>
  );
}
```

**2. Compound Components**
```typescript
<RecordingCard>
  <RecordingCard.Title>My Recording</RecordingCard.Title>
  <RecordingCard.Duration>00:05:23</RecordingCard.Duration>
  <RecordingCard.Actions>
    <PlayButton />
    <DeleteButton />
  </RecordingCard.Actions>
</RecordingCard>
```

### 2. Business Logic Layer

#### Hooks

Custom hooks encapsulate business logic and side effects.

**useRecording** - Main recording hook
```typescript
export function useRecording() {
  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    handleStatusUpdate
  );
  const addRecording = useRecordingStore(s => s.addRecording);
  const [error, setError] = useState<Error | null>(null);

  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermissions();
      if (!hasPermission) throw new Error('Permission denied');

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      setError(err as Error);
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording URI');

      await saveRecording(uri);
    } catch (err) {
      setError(err as Error);
    }
  };

  return {
    startRecording,
    stopRecording,
    isRecording: recorder.isRecording,
    currentTime: recorder.currentTime,
    error,
  };
}
```

**useAudioPermissions** - Permission management
```typescript
export function useAudioPermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const requestPermission = async () => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    setStatus(granted ? 'granted' : 'denied');
    return granted;
  };

  const checkPermission = async () => {
    const { status } = await AudioModule.getRecordingPermissionsAsync();
    setStatus(status);
    return status === 'granted';
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return { status, requestPermission, checkPermission };
}
```

#### State Management (Zustand)

**Why Zustand?**
- Minimal boilerplate
- No provider hell
- Excellent TypeScript support
- Small bundle size (<1KB)
- Easy to learn

**Store Structure**:
```typescript
// src/features/recording/store/recordingStore.ts
interface Recording {
  id: string;
  filename: string;
  title: string;
  duration: number;
  size: number;
  createdAt: number;
  recordingMode: 'microphone' | 'system';
  uri: string;
}

interface RecordingStore {
  // State
  recordings: Recording[];
  currentRecording: Recording | null;
  isLoading: boolean;
  error: string | null;

  // Sync actions
  setRecordings: (recordings: Recording[]) => void;
  addRecording: (recording: Recording) => void;
  updateRecording: (id: string, data: Partial<Recording>) => void;
  removeRecording: (id: string) => void;
  setCurrentRecording: (recording: Recording | null) => void;

  // Async actions
  loadRecordings: () => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  // Initial state
  recordings: [],
  currentRecording: null,
  isLoading: false,
  error: null,

  // Sync actions
  setRecordings: (recordings) => set({ recordings }),

  addRecording: (recording) =>
    set((state) => ({
      recordings: [recording, ...state.recordings],
    })),

  updateRecording: (id, data) =>
    set((state) => ({
      recordings: state.recordings.map((r) =>
        r.id === id ? { ...r, ...data } : r
      ),
    })),

  removeRecording: (id) =>
    set((state) => ({
      recordings: state.recordings.filter((r) => r.id !== id),
    })),

  setCurrentRecording: (recording) => set({ currentRecording: recording }),

  // Async actions
  loadRecordings: async () => {
    set({ isLoading: true, error: null });
    try {
      const recordings = await StorageService.loadRecordings();
      set({ recordings, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteRecording: async (id) => {
    const recording = get().recordings.find((r) => r.id === id);
    if (!recording) return;

    try {
      await StorageService.deleteRecording(recording.filename);
      get().removeRecording(id);
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
```

**Store Usage**:
```typescript
// In component
function RecordingsScreen() {
  const recordings = useRecordingStore(s => s.recordings);
  const loadRecordings = useRecordingStore(s => s.loadRecordings);
  const deleteRecording = useRecordingStore(s => s.deleteRecording);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  return (
    <FlatList
      data={recordings}
      renderItem={({ item }) => (
        <RecordingItem
          recording={item}
          onDelete={() => deleteRecording(item.id)}
        />
      )}
    />
  );
}
```

#### Services

Services encapsulate business logic and platform APIs.

**audioService.ts** - Audio recording logic
```typescript
// src/services/audioService.ts
export class AudioService {
  private static audioMode: AudioMode = {
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  };

  static async initialize() {
    await setAudioModeAsync(this.audioMode);
  }

  static async requestPermission(): Promise<boolean> {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    return granted;
  }

  static async checkPermission(): Promise<boolean> {
    const { status } = await AudioModule.getRecordingPermissionsAsync();
    return status === 'granted';
  }

  static createRecorder(quality: RecordingQuality = 'HIGH_QUALITY') {
    return useAudioRecorder(
      RecordingPresets[quality],
      (status) => console.log('Recording status:', status)
    );
  }
}
```

**storageService.ts** - File system operations
```typescript
// src/services/storageService.ts
export class StorageService {
  private static RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;
  private static METADATA_KEY = '@recordings_metadata';

  static async initialize() {
    const dirInfo = await FileSystem.getInfoAsync(this.RECORDINGS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.RECORDINGS_DIR, {
        intermediates: true,
      });
    }
  }

  static async saveRecording(
    uri: string,
    metadata: RecordingMetadata
  ): Promise<Recording> {
    const filename = `recording_${Date.now()}_${uuid()}.m4a`;
    const newUri = this.RECORDINGS_DIR + filename;

    // Move file from temp location to recordings directory
    await FileSystem.moveAsync({ from: uri, to: newUri });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(newUri);

    const recording: Recording = {
      id: uuid(),
      filename,
      uri: newUri,
      size: fileInfo.size || 0,
      createdAt: Date.now(),
      ...metadata,
    };

    // Save metadata
    await this.saveMetadata(recording);

    return recording;
  }

  static async loadRecordings(): Promise<Recording[]> {
    const metadata = await AsyncStorage.getItem(this.METADATA_KEY);
    if (!metadata) return [];

    const recordings: Recording[] = JSON.parse(metadata);

    // Verify files still exist
    const validRecordings = await Promise.all(
      recordings.map(async (recording) => {
        const info = await FileSystem.getInfoAsync(recording.uri);
        return info.exists ? recording : null;
      })
    );

    return validRecordings.filter(Boolean) as Recording[];
  }

  static async deleteRecording(filename: string): Promise<void> {
    const uri = this.RECORDINGS_DIR + filename;
    await FileSystem.deleteAsync(uri);

    // Update metadata
    const recordings = await this.loadRecordings();
    const updated = recordings.filter((r) => r.filename !== filename);
    await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));
  }

  private static async saveMetadata(recording: Recording): Promise<void> {
    const recordings = await this.loadRecordings();
    recordings.unshift(recording);
    await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(recordings));
  }
}
```

### 3. Platform Layer

#### expo-audio Integration

**Recording Flow**:
```
1. Request permission
2. Configure audio mode
3. Create recorder with useAudioRecorder hook
4. Prepare to record: prepareToRecordAsync()
5. Start recording: record()
6. Monitor state: useAudioRecorderState()
7. Stop recording: stop()
8. Get URI: recorder.uri
9. Save file to permanent location
```

**Audio Modes**:
```typescript
const RECORDING_MODE: AudioMode = {
  allowsRecording: true,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  staysActiveInBackground: true,
};

const PLAYBACK_MODE: AudioMode = {
  allowsRecording: false,
  playsInSilentMode: false,
  shouldPlayInBackground: false,
};
```

#### expo-file-system Integration

**Directory Structure**:
```
FileSystem.documentDirectory/
└── recordings/
    ├── recording_1234567890_abc-123.m4a
    ├── recording_1234567891_def-456.m4a
    └── recording_1234567892_ghi-789.m4a
```

**File Operations**:
- `moveAsync()` - Move temp recording to permanent location
- `deleteAsync()` - Delete recording
- `getInfoAsync()` - Get file metadata (size, exists)
- `readDirectoryAsync()` - List all recordings

### 4. Native Layer (Phase 3)

#### macOS ScreenCaptureKit Module

**Module Structure**:
```
modules/system-audio-macos/
├── ios/                           # Swift implementation
│   ├── SystemAudioMacOS.swift    # Main module
│   ├── AudioCaptureSession.swift # Capture logic
│   └── PermissionManager.swift   # Permission handling
├── src/
│   └── index.ts                  # TypeScript bridge
├── expo-module.config.json       # Expo module config
└── README.md                     # Implementation guide
```

**ScreenCaptureKit Flow**:
```
1. Check screen recording permission
2. If not granted, guide user to Settings
3. Present SCContentSharingPicker
4. User selects content (display, window, or app)
5. Configure SCStreamConfiguration
   - Audio only (no video)
   - Sample rate: 48000 Hz
   - Channel count: 2 (stereo)
6. Create SCStream with configuration
7. Add stream output delegate
8. Start stream
9. Receive audio samples in delegate
10. Write samples to file
11. Stop stream
12. Return file URI
```

**Swift Implementation Sketch**:
```swift
import ScreenCaptureKit

class AudioCaptureSession: NSObject, SCStreamOutput {
  private var stream: SCStream?
  private var fileWriter: AVAssetWriter?

  func startCapture(content: SCShareableContent) async throws {
    let config = SCStreamConfiguration()
    config.capturesAudio = true
    config.sampleRate = 48000
    config.channelCount = 2

    let filter = SCContentFilter(
      desktopIndependentWindow: content.windows.first!
    )

    stream = SCStream(
      filter: filter,
      configuration: config,
      delegate: nil
    )

    try stream?.addStreamOutput(self, type: .audio)
    try await stream?.startCapture()
  }

  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of type: SCStreamOutputType
  ) {
    guard type == .audio else { return }
    // Write audio samples to file
    fileWriter?.append(sampleBuffer)
  }
}
```

**TypeScript Bridge**:
```typescript
// modules/system-audio-macos/src/index.ts
import { NativeModulesProxy } from 'expo-modules-core';

const SystemAudioMacOS = NativeModulesProxy.SystemAudioMacOS;

export async function startSystemAudioCapture(): Promise<void> {
  await SystemAudioMacOS.startCapture();
}

export async function stopSystemAudioCapture(): Promise<string> {
  const uri = await SystemAudioMacOS.stopCapture();
  return uri;
}

export async function checkScreenRecordingPermission(): Promise<boolean> {
  return await SystemAudioMacOS.checkPermission();
}
```

## Data Flow

### Recording Flow (Microphone)

```
User taps "Record" button
    ↓
RecordButton.onPress()
    ↓
useRecording.startRecording()
    ↓
AudioService.requestPermission()
    ↓
[Permission granted]
    ↓
recorder.prepareToRecordAsync()
    ↓
recorder.record()
    ↓
[Recording in progress]
    ↓
useAudioRecorderState() updates UI
    ↓
User taps "Stop"
    ↓
useRecording.stopRecording()
    ↓
recorder.stop()
    ↓
Get recorder.uri
    ↓
StorageService.saveRecording(uri, metadata)
    ↓
useRecordingStore.addRecording(recording)
    ↓
UI updates with new recording
```

### Loading Recordings Flow

```
App launches
    ↓
RecordingsScreen mounts
    ↓
useEffect(() => loadRecordings(), [])
    ↓
useRecordingStore.loadRecordings()
    ↓
StorageService.loadRecordings()
    ↓
Read metadata from AsyncStorage
    ↓
Verify files exist
    ↓
Return Recording[]
    ↓
useRecordingStore.setRecordings(recordings)
    ↓
UI renders list
```

## Error Handling

### Error Boundaries

```typescript
// app/_layout.tsx
export default function RootLayout() {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <Stack />
    </ErrorBoundary>
  );
}

function ErrorFallback({ error, resetError }: ErrorBoundaryProps) {
  return (
    <View>
      <Text>Something went wrong!</Text>
      <Text>{error.message}</Text>
      <Button title="Try again" onPress={resetError} />
    </View>
  );
}
```

### Service-Level Error Handling

```typescript
class AudioServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

export class AudioService {
  static async startRecording() {
    try {
      // ... recording logic
    } catch (error) {
      if (error.code === 'E_PERMISSION_DENIED') {
        throw new AudioServiceError(
          'Microphone permission denied',
          'PERMISSION_DENIED',
          true // User can grant permission
        );
      }
      throw new AudioServiceError(
        'Failed to start recording',
        'RECORDING_FAILED',
        false
      );
    }
  }
}
```

### Hook-Level Error Handling

```typescript
export function useRecording() {
  const [error, setError] = useState<AudioServiceError | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      await AudioService.startRecording();
    } catch (err) {
      setError(err as AudioServiceError);

      if (err.recoverable) {
        // Show actionable error message
        Alert.alert(
          'Permission Required',
          err.message,
          [{ text: 'Open Settings', onPress: openSettings }]
        );
      } else {
        // Show generic error
        Alert.alert('Error', err.message);
      }
    }
  };

  return { startRecording, error };
}
```

## Performance Considerations

### 1. Lazy Loading
```typescript
// Lazy load heavy components
const AudioVisualizer = lazy(() => import('@/features/recording/components/AudioVisualizer'));
```

### 2. Memoization
```typescript
const RecordingItem = memo(({ recording, onDelete }: Props) => {
  // Component implementation
});

const memoizedRecordings = useMemo(
  () => recordings.filter(r => r.duration > 10),
  [recordings]
);
```

### 3. Virtualized Lists
```typescript
<FlashList
  data={recordings}
  estimatedItemSize={80}
  renderItem={renderRecordingItem}
/>
```

### 4. Debouncing/Throttling
```typescript
const debouncedSearch = useMemo(
  () => debounce(searchRecordings, 300),
  []
);
```

## Security Considerations

### 1. Permission Handling
- Request permissions at appropriate time
- Clear explanation of why permission is needed
- Graceful degradation if permission denied

### 2. File Storage
- Store recordings in app sandbox (documentDirectory)
- No external storage without user consent
- Secure deletion when removing recordings

### 3. Data Privacy
- No analytics without user consent
- No automatic cloud upload
- Clear data retention policy

## Testing Strategy

### Unit Tests
```typescript
// audioService.test.ts
describe('AudioService', () => {
  it('should request permission', async () => {
    const granted = await AudioService.requestPermission();
    expect(granted).toBe(true);
  });
});
```

### Integration Tests
```typescript
// recording.integration.test.ts
describe('Recording Flow', () => {
  it('should record and save audio', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      await result.current.stopRecording();
    });

    const store = useRecordingStore.getState();
    expect(store.recordings).toHaveLength(1);
  });
});
```

### Component Tests
```typescript
// RecordButton.test.tsx
describe('RecordButton', () => {
  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <RecordButton onPress={onPress} isRecording={false} />
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

## Build & Deployment

### Development Build
```bash
# iOS Simulator
eas build --profile development --platform ios --local

# Physical device
eas build --profile development --platform ios
```

### Production Build
```bash
# Create production build
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

### Over-the-Air Updates
```bash
# Publish update
eas update --branch production --message "Bug fixes"
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-05
