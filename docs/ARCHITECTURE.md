# Architecture Documentation (REVISED)

## Overview

This document describes the technical architecture of the Recording App, a **cross-platform audio recording application** built with **Electron + React Native Web** (desktop) and **React Native/Expo** (iOS), maximizing code sharing through a monorepo structure.

## Architecture Principles

### 1. Maximum Code Reuse (80-90%)
Share as much code as possible between platforms using React Native Web, while keeping platform-specific code isolated in adapters.

### 2. Platform Abstraction
Platform-specific implementations hidden behind unified interfaces. The app logic doesn't know if it's running on iOS or Electron.

### 3. Separation of Concerns
Clear boundaries between UI, business logic, and platform layers:
```
UI Layer (React Components)
    ↓
Business Logic (Hooks, Services)
    ↓
Platform Abstraction (Adapters)
    ↓
Platform Implementation (expo-audio, Electron IPC, Native Addons)
```

### 4. Type Safety First
Strict TypeScript throughout. Shared types ensure consistency across packages.

### 5. Monorepo for Scale
Independent packages with shared code, managed with pnpm workspaces + Turborepo for fast builds.

## System Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      MONOREPO ROOT                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  packages/ │  │  packages/ │  │    packages/           │ │
│  │   mobile   │  │  desktop   │  │     shared             │ │
│  │            │  │            │  │                        │ │
│  │  React     │  │  Electron  │  │  React Native          │ │
│  │  Native    │  │  +         │  │  Components            │ │
│  │  + Expo    │  │  RN Web    │  │  + Business Logic      │ │
│  │            │  │            │  │  + Zustand Stores      │ │
│  │  (iOS)     │  │  (Desktop) │  │  + Utils & Types       │ │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────────────┘ │
│        │                │                  │                  │
│        └────────────────┴──────────────────┘                  │
│                         │                                     │
│                  Imports shared package                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         native-modules/                                 │  │
│  │         electron-screencapturekit/                      │  │
│  │                                                         │  │
│  │         Node.js Native Addon (C++/ObjC++)             │  │
│  │         macOS ScreenCaptureKit bindings                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Package Dependency Graph

```
packages/mobile  ─────┐
                      ├──→  packages/shared
packages/desktop ─────┘
                            ↓
                     (consumes types,
                      components,
                      hooks, services)

packages/desktop ────→ native-modules/electron-screencapturekit
                      (uses for system audio capture)
```

## Layer Architecture

### 1. Shared Package (Platform-Agnostic)

The heart of the app - **80-90% of the codebase**.

#### Structure
```
packages/shared/src/
├── features/                    # Feature-based organization
│   └── recording/
│       ├── components/
│       │   ├── RecordButton.tsx            # ✅ Works on iOS & Electron
│       │   ├── RecordingTimer.tsx          # ✅ Works everywhere
│       │   ├── RecordingsList.tsx          # ✅ Shared UI
│       │   └── AudioWaveform.tsx           # ✅ Platform-agnostic
│       ├── hooks/
│       │   ├── useRecording.ts             # 🎯 Core recording logic
│       │   ├── useRecordingPermissions.ts  # Platform adapter
│       │   └── useAudioPlayer.ts           # Playback logic
│       ├── store/
│       │   └── recordingStore.ts           # Zustand store
│       ├── services/
│       │   ├── audioService.ts             # Platform abstraction
│       │   └── storageService.ts           # File operations
│       └── types/
│           └── recording.types.ts          # Shared types
├── components/                  # Reusable UI
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Modal.tsx
├── utils/
│   ├── platform.ts             # Platform detection
│   ├── formatDuration.ts
│   └── audioUtils.ts
└── types/
    └── index.ts                # Global types
```

#### Key Components

**RecordButton.tsx** (Works on iOS + Electron)
```typescript
import { TouchableOpacity, View, StyleSheet } from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function RecordButton({ isRecording, onPress, disabled }: RecordButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        isRecording && styles.recording,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.inner, isRecording && styles.innerRecording]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recording: {
    backgroundColor: '#EF4444',
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
  },
  innerRecording: {
    width: 30,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
});
```

**✅ This exact code works on:**
- iOS (React Native)
- Desktop (React Native Web in Electron)
- **Zero platform-specific code needed**

#### Platform Abstraction Layer

**audioService.ts** - Platform-agnostic interface
```typescript
// packages/shared/src/features/recording/services/audioService.ts
import { isElectron, isIOS } from '../../../utils/platform';

export type RecordingMode = 'microphone' | 'system';

export interface AudioServiceInterface {
  requestPermission(): Promise<boolean>;
  startRecording(mode: RecordingMode): Promise<void>;
  stopRecording(): Promise<string>; // Returns file URI
  isRecording(): boolean;
  getDuration(): number;
}

class AudioService implements AudioServiceInterface {
  private adapter: AudioServiceInterface;

  constructor() {
    // Select platform-specific adapter
    if (isElectron()) {
      // Loaded from desktop package
      this.adapter = new ElectronAudioAdapter();
    } else if (isIOS()) {
      // Loaded from mobile package
      this.adapter = new ExpoAudioAdapter();
    } else {
      throw new Error('Unsupported platform');
    }
  }

  async requestPermission(): Promise<boolean> {
    return this.adapter.requestPermission();
  }

  async startRecording(mode: RecordingMode): Promise<void> {
    if (mode === 'system' && !isElectron()) {
      throw new Error('System audio only available on desktop');
    }
    return this.adapter.startRecording(mode);
  }

  async stopRecording(): Promise<string> {
    return this.adapter.stopRecording();
  }

  isRecording(): boolean {
    return this.adapter.isRecording();
  }

  getDuration(): number {
    return this.adapter.getDuration();
  }
}

export const audioService = new AudioService();
```

**platform.ts** - Platform detection utilities
```typescript
// packages/shared/src/utils/platform.ts

export const isElectron = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).electron !== 'undefined'
  );
};

export const isNative = (): boolean => {
  return (
    !isElectron() &&
    typeof navigator !== 'undefined' &&
    (navigator as any).product === 'ReactNative'
  );
};

export const isIOS = (): boolean => {
  if (!isNative()) return false;

  // React Native Platform API
  const { Platform } = require('react-native');
  return Platform.OS === 'ios';
};

export const isMacOS = (): boolean => {
  return isElectron() && process.platform === 'darwin';
};

export const isWindows = (): boolean => {
  return isElectron() && process.platform === 'win32';
};

export const isLinux = (): boolean => {
  return isElectron() && process.platform === 'linux';
};
```

#### State Management (Zustand)

**recordingStore.ts**
```typescript
// packages/shared/src/features/recording/store/recordingStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Recording {
  id: string;
  filename: string;
  title: string;
  duration: number; // seconds
  size: number; // bytes
  createdAt: number; // timestamp
  recordingMode: 'microphone' | 'system';
  uri: string;
  waveform?: number[]; // Optional waveform data
}

interface RecordingStore {
  // State
  recordings: Recording[];
  currentRecording: Recording | null;
  isRecording: boolean;
  recordingMode: 'microphone' | 'system';

  // Actions
  setRecordings: (recordings: Recording[]) => void;
  addRecording: (recording: Recording) => void;
  updateRecording: (id: string, data: Partial<Recording>) => void;
  removeRecording: (id: string) => void;
  setCurrentRecording: (recording: Recording | null) => void;
  setIsRecording: (isRecording: boolean) => void;
  setRecordingMode: (mode: 'microphone' | 'system') => void;

  // Async actions
  loadRecordings: () => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
}

export const useRecordingStore = create<RecordingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      recordings: [],
      currentRecording: null,
      isRecording: false,
      recordingMode: 'microphone',

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
      setIsRecording: (isRecording) => set({ isRecording }),
      setRecordingMode: (recordingMode) => set({ recordingMode }),

      // Async actions
      loadRecordings: async () => {
        try {
          const { storageService } = await import('../services/storageService');
          const recordings = await storageService.loadRecordings();
          set({ recordings });
        } catch (error) {
          console.error('Failed to load recordings:', error);
        }
      },

      deleteRecording: async (id) => {
        const recording = get().recordings.find((r) => r.id === id);
        if (!recording) return;

        try {
          const { storageService } = await import('../services/storageService');
          await storageService.deleteRecording(recording.filename);
          get().removeRecording(id);
        } catch (error) {
          console.error('Failed to delete recording:', error);
          throw error;
        }
      },
    }),
    {
      name: 'recording-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recordings: state.recordings,
        recordingMode: state.recordingMode,
      }),
    }
  )
);
```

**Store Usage:**
```typescript
// In any component (iOS or Electron)
import { useRecordingStore } from '@recording-app/shared/features/recording/store/recordingStore';

function RecordingsListScreen() {
  const recordings = useRecordingStore(s => s.recordings);
  const deleteRecording = useRecordingStore(s => s.deleteRecording);
  const loadRecordings = useRecordingStore(s => s.loadRecordings);

  useEffect(() => {
    loadRecordings();
  }, []);

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

### 2. Mobile Package (iOS - React Native + Expo)

**iOS-specific adapter using expo-audio (real API)**

#### ExpoAudioAdapter.ts
```typescript
// packages/mobile/src/adapters/ExpoAudioAdapter.ts
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioServiceInterface, RecordingMode } from '@recording-app/shared';

export class ExpoAudioAdapter implements AudioServiceInterface {
  private recorder: ReturnType<typeof useAudioRecorder> | null = null;
  private recorderState: ReturnType<typeof useAudioRecorderState> | null = null;

  async requestPermission(): Promise<boolean> {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    return granted;
  }

  async startRecording(mode: RecordingMode): Promise<void> {
    if (mode === 'system') {
      throw new Error('System audio not supported on iOS');
    }

    // Configure audio mode
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      staysActiveInBackground: true,
    });

    // Initialize recorder
    if (!this.recorder) {
      // In real implementation, this would be in a hook
      const { useAudioRecorder } = await import('expo-audio');
      this.recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    }

    // Start recording
    await this.recorder.prepareToRecordAsync();
    this.recorder.record();
  }

  async stopRecording(): Promise<string> {
    if (!this.recorder) {
      throw new Error('No active recording');
    }

    await this.recorder.stop();
    const uri = this.recorder.uri;

    if (!uri) {
      throw new Error('No recording URI');
    }

    return uri;
  }

  isRecording(): boolean {
    return this.recorder?.isRecording ?? false;
  }

  getDuration(): number {
    return this.recorder?.durationMillis ?? 0;
  }
}
```

#### Real expo-audio Hook Usage
```typescript
// packages/mobile/app/(tabs)/index.tsx
import { useState, useEffect } from 'react';
import { View, Button, Text, Alert } from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { useRecordingStore } from '@recording-app/shared';

export default function RecordingScreen() {
  // expo-audio hooks
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Zustand store
  const addRecording = useRecordingStore(s => s.addRecording);

  const startRecording = async () => {
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const stopRecording = async () => {
    await audioRecorder.stop();

    // Save to store
    if (audioRecorder.uri) {
      addRecording({
        id: Date.now().toString(),
        filename: `recording_${Date.now()}.m4a`,
        title: `Recording ${new Date().toLocaleString()}`,
        duration: Math.round(recorderState.durationMillis / 1000),
        size: 0, // Will be filled by storage service
        createdAt: Date.now(),
        recordingMode: 'microphone',
        uri: audioRecorder.uri,
      });
    }
  };

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission denied');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button
        title={recorderState.isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={recorderState.isRecording ? stopRecording : startRecording}
      />
      {recorderState.isRecording && (
        <Text>
          Duration: {Math.round(recorderState.durationMillis / 1000)}s
        </Text>
      )}
    </View>
  );
}
```

### 3. Desktop Package (Electron + React Native Web)

#### Electron Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Electron App                          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────┐              ┌──────────────────┐   │
│  │  Main Process  │              │ Renderer Process │   │
│  │   (Node.js)    │              │  (RN Web + React)│   │
│  │                │◄────IPC─────►│                  │   │
│  │  - IPC Handler │              │  - UI Components │   │
│  │  - File System │              │  - Shared Code   │   │
│  │  - Native      │              │  - Business Logic│   │
│  │    Modules     │              │                  │   │
│  └────────┬───────┘              └──────────────────┘   │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────┐                        │
│  │  Native Module               │                        │
│  │  electron-screencapturekit   │                        │
│  │  (C++/Obj-C++  Node Addon)  │                        │
│  │                              │                        │
│  │  - ScreenCaptureKit bindings │                        │
│  │  - System audio capture      │                        │
│  └─────────────────────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

#### Main Process (IPC Handlers)
```typescript
// packages/desktop/src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { MacOSAudioCapture } from './audio/macos-capture';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let audioCapture: MacOSAudioCapture | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// IPC Handlers
ipcMain.handle('audio:checkPermission', async () => {
  if (process.platform === 'darwin') {
    return MacOSAudioCapture.checkScreenRecordingPermission();
  }
  return true;
});

ipcMain.handle('audio:requestPermission', async () => {
  if (process.platform === 'darwin') {
    return MacOSAudioCapture.requestScreenRecordingPermission();
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
  if (!audioCapture) {
    throw new Error('No active capture');
  }

  const filePath = await audioCapture.stop();
  audioCapture = null;
  return filePath;
});

ipcMain.handle('audio:getCaptureStatus', async () => {
  if (!audioCapture) {
    return { isCapturing: false };
  }

  return {
    isCapturing: audioCapture.isCapturing,
    duration: audioCapture.duration,
    fileSize: audioCapture.fileSize,
  };
});

app.whenReady().then(createWindow);
```

#### Preload Script (Secure IPC Bridge)
```typescript
// packages/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electron', {
  audio: {
    checkPermission: () =>
      ipcRenderer.invoke('audio:checkPermission'),

    requestPermission: () =>
      ipcRenderer.invoke('audio:requestPermission'),

    startSystemCapture: (options: any) =>
      ipcRenderer.invoke('audio:startSystemCapture', options),

    stopSystemCapture: () =>
      ipcRenderer.invoke('audio:stopSystemCapture'),

    getCaptureStatus: () =>
      ipcRenderer.invoke('audio:getCaptureStatus'),
  },
});

// TypeScript declarations
declare global {
  interface Window {
    electron: {
      audio: {
        checkPermission(): Promise<boolean>;
        requestPermission(): Promise<boolean>;
        startSystemCapture(options: any): Promise<void>;
        stopSystemCapture(): Promise<string>;
        getCaptureStatus(): Promise<{
          isCapturing: boolean;
          duration?: number;
          fileSize?: number;
        }>;
      };
    };
  }
}
```

#### Electron Audio Adapter
```typescript
// packages/desktop/src/adapters/ElectronAudioAdapter.ts
import type { AudioServiceInterface, RecordingMode } from '@recording-app/shared';

export class ElectronAudioAdapter implements AudioServiceInterface {
  private _isRecording = false;
  private _startTime: number | null = null;

  async requestPermission(): Promise<boolean> {
    return window.electron.audio.checkPermission();
  }

  async startRecording(mode: RecordingMode): Promise<void> {
    if (mode === 'system') {
      const hasPermission = await window.electron.audio.checkPermission();

      if (!hasPermission) {
        const granted = await window.electron.audio.requestPermission();
        if (!granted) {
          throw new Error('Screen Recording permission denied');
        }
      }

      await window.electron.audio.startSystemCapture({
        source: 'display',
        quality: 'high',
      });
    } else {
      // Microphone recording via Web Audio API
      // Implementation here
    }

    this._isRecording = true;
    this._startTime = Date.now();
  }

  async stopRecording(): Promise<string> {
    const uri = await window.electron.audio.stopSystemCapture();
    this._isRecording = false;
    this._startTime = null;
    return uri;
  }

  isRecording(): boolean {
    return this._isRecording;
  }

  getDuration(): number {
    if (!this._startTime) return 0;
    return Date.now() - this._startTime;
  }
}
```

#### Renderer (React Native Web)
```typescript
// packages/desktop/src/renderer/App.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { RecordButton, RecordingsList } from '@recording-app/shared';
import { useRecordingStore } from '@recording-app/shared';

export default function App() {
  const isRecording = useRecordingStore(s => s.isRecording);
  const recordings = useRecordingStore(s => s.recordings);

  return (
    <View style={{ flex: 1 }}>
      <Text>Recording App (Electron)</Text>
      <RecordButton isRecording={isRecording} onPress={() => {}} />
      <RecordingsList recordings={recordings} />
    </View>
  );
}
```

### 4. Native Modules Layer

#### ScreenCaptureKit Node.js Addon

See [modules/electron-screencapturekit/README.md](../modules/electron-screencapturekit/README.md) for full implementation.

**Key Points:**
- Written in C++/Objective-C++ using Node-API
- Wraps macOS ScreenCaptureKit framework
- Exposes async methods to JavaScript
- Handles audio stream capture and file writing

## Data Flow Examples

### Recording Flow (iOS)

```
User Taps "Record"
    ↓
RecordButton.onPress()
    ↓
useRecording.startRecording()
    ↓
audioService.startRecording('microphone')
    ↓
ExpoAudioAdapter.startRecording()
    ↓
expo-audio: AudioModule.requestRecordingPermissionsAsync()
    ↓
[Permission Granted]
    ↓
setAudioModeAsync({ allowsRecording: true })
    ↓
recorder.prepareToRecordAsync()
    ↓
recorder.record()
    ↓
useRecordingStore.setIsRecording(true)
    ↓
[Recording in Progress]
    ↓
useAudioRecorderState() updates UI every 500ms
    ↓
User Taps "Stop"
    ↓
recorder.stop()
    ↓
Save file: storageService.saveRecording(recorder.uri)
    ↓
useRecordingStore.addRecording(recording)
    ↓
UI updates with new recording
```

### System Audio Flow (macOS/Electron)

```
User Clicks "Record System Audio"
    ↓
RecordButton.onPress()
    ↓
audioService.startRecording('system')
    ↓
ElectronAudioAdapter.startRecording('system')
    ↓
window.electron.audio.checkPermission()
    ↓
[If not granted]
    ↓
window.electron.audio.requestPermission()
    ↓
[Opens System Preferences]
    ↓
User grants permission
    ↓
window.electron.audio.startSystemCapture()
    ↓
IPC: Main Process receives request
    ↓
MacOSAudioCapture.start()
    ↓
Native Addon: screencapturekit.start()
    ↓
ScreenCaptureKit: SCStream starts
    ↓
Audio samples streamed to file
    ↓
User Clicks "Stop"
    ↓
window.electron.audio.stopSystemCapture()
    ↓
Native Addon: screencapturekit.stop()
    ↓
Returns file path via IPC
    ↓
storageService.saveRecording(filePath)
    ↓
useRecordingStore.addRecording(recording)
    ↓
UI updates
```

## Monorepo Setup

### pnpm Workspaces

**pnpm-workspace.yaml**
```yaml
packages:
  - 'packages/*'
  - 'native-modules/*'
```

**Root package.json**
```json
{
  "name": "recording-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### Turborepo Configuration

**turbo.json**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Package Dependencies

**packages/mobile/package.json**
```json
{
  "name": "@recording-app/mobile",
  "version": "0.1.0",
  "dependencies": {
    "expo": "~54.0.0",
    "expo-audio": "~14.0.0",
    "expo-router": "~4.0.0",
    "expo-file-system": "~18.0.0",
    "@recording-app/shared": "workspace:*"
  }
}
```

**packages/desktop/package.json**
```json
{
  "name": "@recording-app/desktop",
  "version": "0.1.0",
  "dependencies": {
    "electron": "^32.0.0",
    "@electron/remote": "^2.1.2",
    "@recording-app/shared": "workspace:*",
    "@recording-app/electron-screencapturekit": "workspace:*"
  }
}
```

**packages/shared/package.json**
```json
{
  "name": "@recording-app/shared",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-web": "~0.19.0",
    "zustand": "^5.0.0"
  }
}
```

## Design Patterns

### 1. Adapter Pattern (Platform Abstraction)

Different platforms → Same interface

```typescript
interface AudioServiceInterface {
  startRecording(mode: RecordingMode): Promise<void>;
  stopRecording(): Promise<string>;
  // ...
}

class ExpoAudioAdapter implements AudioServiceInterface { /* iOS */ }
class ElectronAudioAdapter implements AudioServiceInterface { /* Desktop */ }

// Usage
const adapter = isElectron()
  ? new ElectronAudioAdapter()
  : new ExpoAudioAdapter();
```

### 2. State Machine Pattern (Recording States)

```typescript
type RecordingState =
  | { status: 'idle' }
  | { status: 'requesting-permission' }
  | { status: 'preparing' }
  | { status: 'recording'; startTime: number }
  | { status: 'stopping' }
  | { status: 'error'; error: Error };

function recordingReducer(
  state: RecordingState,
  action: RecordingAction
): RecordingState {
  switch (state.status) {
    case 'idle':
      if (action.type === 'START_REQUESTED') {
        return { status: 'requesting-permission' };
      }
      break;

    case 'requesting-permission':
      if (action.type === 'PERMISSION_GRANTED') {
        return { status: 'preparing' };
      }
      if (action.type === 'PERMISSION_DENIED') {
        return { status: 'error', error: new Error('Permission denied') };
      }
      break;

    case 'preparing':
      if (action.type === 'RECORDING_STARTED') {
        return { status: 'recording', startTime: Date.now() };
      }
      break;

    case 'recording':
      if (action.type === 'STOP_REQUESTED') {
        return { status: 'stopping' };
      }
      break;

    case 'stopping':
      if (action.type === 'STOPPED') {
        return { status: 'idle' };
      }
      break;
  }

  return state;
}
```

### 3. Repository Pattern (Data Access)

```typescript
interface RecordingRepository {
  findAll(): Promise<Recording[]>;
  findById(id: string): Promise<Recording | null>;
  create(recording: Omit<Recording, 'id'>): Promise<Recording>;
  update(id: string, data: Partial<Recording>): Promise<Recording>;
  delete(id: string): Promise<void>;
}

class FileSystemRecordingRepository implements RecordingRepository {
  // Platform-specific implementation
}
```

### 4. Observer Pattern (Real-time Updates)

Zustand provides this out of the box:

```typescript
// Component A
const recordings = useRecordingStore(s => s.recordings);

// Component B adds recording
const addRecording = useRecordingStore(s => s.addRecording);
addRecording(newRecording);

// Component A automatically re-renders with new data
```

## Performance Optimizations

### 1. Code Splitting (Electron)

```typescript
// Lazy load heavy dependencies
const SystemAudioModule = lazy(() => import('./SystemAudioModule'));

function RecordingApp() {
  return (
    <Suspense fallback={<Loading />}>
      {isMacOS() && <SystemAudioModule />}
    </Suspense>
  );
}
```

### 2. Memoization

```typescript
const RecordingItem = memo(({ recording, onDelete }: Props) => {
  return (
    <View>
      <Text>{recording.title}</Text>
      <Button onPress={onDelete}>Delete</Button>
    </View>
  );
});

// Prevent re-renders
const sortedRecordings = useMemo(
  () => recordings.sort((a, b) => b.createdAt - a.createdAt),
  [recordings]
);
```

### 3. Virtualized Lists

```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={recordings}
  estimatedItemSize={80}
  renderItem={({ item }) => <RecordingItem recording={item} />}
/>
```

### 4. Turborepo Caching

Turbo caches build outputs across all packages:
```bash
# First build: slow
pnpm build

# Second build: instant (cached)
pnpm build
```

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

```typescript
// packages/shared/src/features/recording/__tests__/RecordButton.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { RecordButton } from '../components/RecordButton';

describe('RecordButton', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <RecordButton onPress={onPress} isRecording={false} />
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows recording state', () => {
    const { getByRole } = render(
      <RecordButton onPress={() => {}} isRecording={true} />
    );

    const button = getByRole('button');
    expect(button.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: '#EF4444' })
    );
  });
});
```

### Integration Tests

```typescript
// Test recording flow end-to-end
describe('Recording Flow', () => {
  it('should record and save audio', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording('microphone');
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

## Security Considerations

### 1. Electron Security

- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Preload script for controlled IPC
- ✅ CSP headers configured

### 2. Permissions

- Request permissions at appropriate time
- Clear explanation of usage
- Graceful degradation if denied

### 3. File Storage

- App sandbox for recordings
- No external access without user consent
- Secure deletion

---

**Document Version**: 2.0 (REVISED)
**Last Updated**: 2025-01-05
**Architecture**: Electron + React Native Web (Desktop) + Expo (iOS)
