# Bridge - Implementation Complete

## Architecture Overview

Bridge now uses a **hybrid recording approach**:

1. **Microphone**: Web MediaRecorder API → WebM/Opus
2. **System Audio (macOS)**: Swift Binary → FLAC (lossless)

### Why This Architecture?

**Swift Binary Bridge Pattern** (adopted from electron-system-audio-recorder):
- ✅ No node-gyp complexity
- ✅ Independent testing (run Swift binary standalone)
- ✅ Process isolation (crash-safe)
- ✅ Direct access to macOS frameworks
- ✅ Easy distribution (pre-compiled binary)

## File Structure

```
bridge/
├── src/
│   ├── main/
│   │   ├── index.js                  # Main process with IPC
│   │   └── audio-bridge.js           # Swift binary spawn wrapper
│   ├── preload/
│   │   └── preload.js                # IPC exposure to renderer
│   ├── renderer/
│   │   ├── index.html                # UI
│   │   └── renderer.js               # Recording logic
│   └── native/
│       └── swift/
│           └── AudioRecorder.swift   # ScreenCaptureKit implementation
├── scripts/
│   └── build-swift.sh                # Swift compilation script
├── docs/research/                    # Research documentation
└── package.json
```

## Implementation Details

### 1. Swift Audio Recorder (230 lines)

**File**: `src/native/swift/AudioRecorder.swift`

**Key Features**:
- ScreenCaptureKit integration
- FLAC output (lossless, 50% smaller than WAV)
- 48kHz stereo, 32-bit float PCM
- Signal handling (SIGINT for graceful shutdown)
- Permission checking
- JSON responses over stdout

**Usage**:
```bash
# Check permissions
./AudioRecorder --check-permissions

# Start recording
./AudioRecorder --record /path/to/output.flac
# ... recording runs ...
# Send SIGINT (Ctrl+C) to stop
```

**Response Format**:
```json
{"code": "RECORDING_STARTED", "path": "/path/to/file.flac", "timestamp": "2025-01-13T..."}
{"code": "RECORDING_STOPPED", "timestamp": "2025-01-13T..."}
{"code": "PERMISSION_DENIED"}
{"code": "WRITE_ERROR", "message": "..."}
```

### 2. Node.js Bridge (95 lines)

**File**: `src/main/audio-bridge.js`

**Responsibilities**:
- Spawn Swift binary as child process
- Parse JSON responses from stdout
- Event emitter pattern for progress updates
- Graceful shutdown via SIGINT

**API**:
```javascript
const { checkPermissions, startRecording } = require('./audio-bridge');

// Check permissions
const granted = await checkPermissions();

// Start recording
const recorder = await startRecording('/path/to/output.flac');

recorder
  .on('start', (response) => console.log('Started', response))
  .on('stop', (response) => console.log('Stopped', response))
  .on('error', (err) => console.error(err));

// Stop recording
recorder.stop(); // Sends SIGINT
```

### 3. Main Process IPC (96 lines)

**File**: `src/main/index.js`

**IPC Handlers**:
- `check-system-audio-permissions`: Check Screen Recording permission
- `start-system-audio`: Start Swift binary recording
- `stop-system-audio`: Stop Swift binary (SIGINT)
- `save-recording`: Save WebM from microphone

**Events Forwarded to Renderer**:
- `recording-started`
- `recording-stopped`
- `recording-error`

### 4. Renderer Integration (240 lines)

**File**: `src/renderer/renderer.js`

**Dual Recording Modes**:

```javascript
// Microphone (WebM/Opus)
await audioRecorder.startMicrophoneAudio();
// Uses MediaRecorder API
// Saves to ~/Documents/Bridge/Recordings/recording_microphone_*.webm

// System Audio (Swift → FLAC)
await audioRecorder.startSystemAudio();
// Spawns Swift binary
// Saves to ~/Documents/Bridge/Recordings/recording_system_*.flac

// Stop (auto-detects mode)
await audioRecorder.stopRecording();
```

## Building & Running

### Prerequisites

**All Platforms**:
- Node.js 20+
- pnpm 8+

**macOS (for system audio)**:
- macOS 13.0+ (13.2+ recommended)
- Xcode Command Line Tools: `xcode-select --install`
- swiftc compiler (included with Xcode CLT)

### Install & Build

```bash
# Install Node dependencies
pnpm install

# Build Swift binary (macOS only, auto-skips on Linux)
pnpm run build:swift

# Run app
pnpm start

# Or run with logging
pnpm run dev
```

### Build Output

```
Building Swift audio recorder binary...
Compiling: src/native/swift/AudioRecorder.swift → src/native/swift/AudioRecorder
✅ Swift binary built successfully
   Output: src/native/swift/AudioRecorder
Mach-O 64-bit executable arm64
```

## Testing

### Microphone Recording (All Platforms)

1. Click "Record Microphone"
2. Allow permission when prompted
3. Speak for 10 seconds
4. Click "Stop Recording"
5. Check console for file path
6. Verify file exists and plays correctly

**Expected Output**:
```
=== Recording Started ===
Mode: microphone
Format: WebM/Opus @ 192kbps, 48kHz

=== Recording Stopped ===
Mode: microphone
Duration: 0:10
Size: 0.23 MB
Saved to: ~/Documents/Bridge/Recordings/recording_microphone_2025-01-13...webm
```

### System Audio Recording (macOS Only)

1. Click "Record System Audio"
2. If permission denied:
   - Open System Settings
   - Privacy & Security → Screen Recording
   - Enable for "Electron" or "Bridge"
   - Restart app
3. Play audio in another app (music, video, etc.)
4. Click "Stop Recording"
5. Check console for file path
6. Verify FLAC file exists and contains system audio

**Expected Output**:
```
=== System Audio Recording (Swift) ===
Mode: ScreenCaptureKit → FLAC
Format: 48kHz stereo, lossless
Starting...

Recording started: {path: "...", timestamp: "..."}
Path: ~/Documents/Bridge/Recordings/recording_system_2025-01-13...flac

=== Recording Stopped ===
Duration: 0:15
Timestamp: 2025-01-13T...
```

## Technical Decisions

### Why FLAC for System Audio?

- **Lossless**: Perfect audio quality
- **Compression**: ~50% smaller than WAV
- **Native Support**: AVFoundation handles encoding
- **Professional**: Standard for audio archiving
- **Conversion**: Easy to convert to other formats later

### Why WebM for Microphone?

- **Browser Native**: MediaRecorder API built-in
- **No Dependencies**: Zero external libraries
- **Cross-Platform**: Works on macOS/Windows/Linux
- **Good Quality**: Opus codec is excellent

### Why CLI Binary Bridge?

**Compared to Node Native Addon**:
| Aspect | CLI Binary | Native Addon |
|--------|-----------|--------------|
| Build Complexity | ✅ Simple | ❌ Complex (node-gyp) |
| Testing | ✅ Standalone | ❌ Needs Node |
| Error Isolation | ✅ Separate process | ❌ Same process |
| Distribution | ✅ Pre-compile | ❌ Platform builds |
| Debugging | ✅ Easy (run binary) | ❌ Hard (gdb/lldb) |

**Compared to Web APIs**:
| Aspect | CLI Binary | getDisplayMedia |
|--------|-----------|-----------------|
| macOS Support | ✅ All versions | ⚠️ 13.2+ only |
| Audio Quality | ✅ Direct PCM | ⚠️ Compressed |
| File Format | ✅ Any (FLAC) | ❌ WebM only |
| Permissions | Manual setup | Auto prompt |

## Functional Programming Patterns Used

### Pure Functions
```javascript
const generateFilename = (mode, ext) =>
  `recording_${mode}_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;

const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
```

### No Classes (Except Swift Requirement)
- All JavaScript is functional
- Swift uses classes (required by ScreenCaptureKit delegate pattern)

### Fail-Fast
- Zero try/catch blocks in renderer
- Errors bubble to global handler
- Clear error messages

### Minimal State
```javascript
// Module-level state only
let mediaRecorder = null;
let recordedChunks = [];
let audioStream = null;
let startTime = null;
let recordingMode = null; // 'microphone' | 'system'
```

## Line Count

**Total Implementation**: ~660 lines

| File | Lines | Purpose |
|------|-------|---------|
| AudioRecorder.swift | 230 | System audio capture |
| audio-bridge.js | 95 | Swift binary wrapper |
| main/index.js | 96 | IPC handlers |
| preload.js | 22 | IPC exposure |
| renderer.js | 240 | Recording UI logic |

**Supporting Files**:
- build-swift.sh: 50 lines
- index.html: 105 lines (with visualizer)

## Known Limitations

1. **System Audio macOS Only**: ScreenCaptureKit is macOS-exclusive
2. **Permission UX**: Screen Recording requires manual System Settings
3. **File Format Mix**: WebM (mic) + FLAC (system) - consider unifying
4. **No Format Conversion**: Files stay in recorded format
5. **Linux**: System audio not implemented (would need PulseAudio monitor)

## Next Steps

### Immediate Improvements
- [ ] Add file format conversion (FLAC → M4A, WebM → M4A)
- [ ] Unify to single format (all recordings → FLAC or M4A)
- [ ] Add recording state UI (timer, waveform)
- [ ] Improve permission error UX (button to open System Settings)

### Future Features
- [ ] Windows system audio (WASAPI loopback)
- [ ] Linux system audio (PulseAudio monitor)
- [ ] Real-time transcription (Whisper API)
- [ ] Settings panel (quality, format, storage location)
- [ ] Recording history/list view

## Troubleshooting

### Swift Binary Won't Build

```bash
# Check if on macOS
uname -s  # Should show "Darwin"

# Check if swiftc exists
which swiftc  # Should show path

# Install Xcode Command Line Tools
xcode-select --install

# Try manual build
cd src/native/swift
swiftc -o AudioRecorder AudioRecorder.swift \
  -framework ScreenCaptureKit \
  -framework AVFoundation \
  -framework CoreMedia
```

### Permission Denied

```bash
# Check permission status
./src/native/swift/AudioRecorder --check-permissions

# If denied, enable in System Settings:
# Settings > Privacy & Security > Screen Recording > Enable "Electron"
```

### Binary Not Found Error

```bash
# Check if binary exists
ls -la src/native/swift/AudioRecorder

# Check if executable
file src/native/swift/AudioRecorder

# Make executable
chmod +x src/native/swift/AudioRecorder
```

## Credits

**Implementation Pattern**: Inspired by [electron-system-audio-recorder](https://github.com/O4FDev/electron-system-audio-recorder) by O4FDev & Sebastian Wąsik

**Key Innovation**: CLI binary bridge pattern for native macOS integration without node-gyp complexity.
