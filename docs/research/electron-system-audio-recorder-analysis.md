# Electron System Audio Recorder - Comprehensive Architecture Analysis

## Overview
The O4FDev/electron-system-audio-recorder is a macOS-native Electron application that demonstrates system audio capture using a native Swift binary bridge. It provides a complete pattern for circumventing Electron's limitations with system audio capture on macOS.

---

## 1. Swift Implementation: System Audio Capture (Recorder.swift)

### Architecture Pattern: CLI-Based Native Bridge
Instead of using Node.js native modules, the implementation uses a **child process approach**:
- Compiles Swift to a standalone binary: `swiftc -o src/swift/Recorder src/swift/Recorder.swift`
- Spawns the binary as a child process from Node.js
- Communicates via JSON over stdout

### Key Swift Classes

#### RecorderCLI: Main Recording Engine
**Core Responsibility**: Orchestrates the entire recording lifecycle

```swift
class RecorderCLI: NSObject, SCStreamDelegate, SCStreamOutput {
    static var screenCaptureStream: SCStream?
    static var audioFileForRecording: AVAudioFile?
    let semaphoreRecordingStopped = DispatchSemaphore(value: 0)
    var streamFunctionTimeout: TimeInterval = 0.5
}
```

**Key Methods**:
1. **processCommandLineArguments()**: Parses Electron's command-line arguments
   - `--record [path]`: Directory where recording should be saved
   - `--filename [name]`: Optional custom filename (otherwise uses timestamp)
   - `--check-permissions`: Verify screen capture permissions

2. **executeRecordingProcess()**: Main lifecycle orchestrator
   - Gets available display content
   - Sets up signal handlers for graceful shutdown
   - Configures a 0.5-second timeout for stream initialization
   - Waits indefinitely until recording stops

3. **setupInterruptSignalHandler()**: Graceful shutdown on SIGINT
   - Catches Ctrl+C from the parent process
   - Stops the capture stream
   - Returns timestamp of when recording stopped

### macOS API Usage: ScreenCaptureKit Framework

#### SCStream Configuration
```swift
let streamConfiguration = SCStreamConfiguration()
configuration.width = 2              // Minimal dimensions (audio-only)
configuration.height = 2
configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale.max)
configuration.showsCursor = false
configuration.capturesAudio = true   // AUDIO IS THE GOAL
configuration.sampleRate = 48000     // High-quality audio
configuration.channelCount = 2       // Stereo
```

**Key Insight**: The app uses ScreenCaptureKit to capture AUDIO by:
1. Creating a minimal video stream (2x2 pixels) to satisfy SCStream requirements
2. Enabling audio capture via `capturesAudio = true`
3. Discarding video frames, processing only audio samples

#### Audio Processing Pipeline

**Sample Buffer Handling** (line 139-148):
```swift
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, 
            of outputType: SCStreamOutputType) {
    self.streamFunctionCalled = true
    guard let audioBuffer = sampleBuffer.asPCMBuffer, sampleBuffer.isValid else { return }
    
    do {
        try RecorderCLI.audioFileForRecording?.write(from: audioBuffer)
    } catch {
        ResponseHandler.returnResponse(["code": "AUDIO_BUFFER_WRITE_FAILED"])
    }
}
```

**Buffer Format Conversion**:
Uses extension methods to convert between CMSampleBuffer and AVAudioPCMBuffer:
- CMSampleBuffer (from ScreenCaptureKit) → AVAudioPCMBuffer (for writing)
- Extracts format description and sample rate from the CMSampleBuffer
- Creates PCM format for audio writing

### Audio File Creation: FLAC Format

**File Format Decision**: FLAC (Free Lossless Audio Codec)
```swift
func prepareAudioFile(at path: String) {
    do {
        RecorderCLI.audioFileForRecording = try AVAudioFile(
            forWriting: URL(fileURLWithPath: path),
            settings: [
                AVSampleRateKey: 48000,           // 48kHz (professional standard)
                AVNumberOfChannelsKey: 2,         // Stereo
                AVFormatIDKey: kAudioFormatFLAC   // Lossless compression
            ],
            commonFormat: .pcmFormatFloat32,
            interleaved: false                    // Planar audio (separate channels)
        )
    } catch {
        ResponseHandler.returnResponse(["code": "AUDIO_FILE_CREATION_FAILED"])
    }
}
```

**Advantages of FLAC**:
- Lossless compression (unlike MP3/AAC)
- Smaller files than WAV
- Good for system audio capture use cases
- Supported natively by AVFoundation

### Permissions Model: CGPreflightScreenCaptureAccess

```swift
class PermissionsRequester {
    static func requestScreenCaptureAccess(completion: @escaping (Bool) -> Void) {
        if !CGPreflightScreenCaptureAccess() {      // Check if permission granted
            let result = CGRequestScreenCaptureAccess()  // Request if not
            completion(result)
        } else {
            completion(true)
        }
    }
}
```

**Permission Flow**:
1. `CGPreflightScreenCaptureAccess()` - Non-blocking check (returns true if already granted)
2. `CGRequestScreenCaptureAccess()` - Shows permission dialog (blocking call)
3. First use: Shows "Allow" dialog in System Preferences > Security & Privacy > Screen Recording
4. Subsequent uses: Granted automatically if previously approved

### Error Handling Strategy

**JSON Response Format**:
```swift
class ResponseHandler {
    static func returnResponse(_ response: [String: Any], shouldExitProcess: Bool = true) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: response),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)  // Force flush to ensure parent reads response
        }
        if shouldExitProcess {
            exit(0)
        }
    }
}
```

**Error Codes** (consumed by Node.js):
- `PERMISSION_GRANTED` / `PERMISSION_DENIED` - Permission checks
- `INVALID_ARGUMENTS` - Bad command-line args
- `NO_PATH_SPECIFIED` - Missing --record argument
- `NO_DISPLAY_FOUND` - No accessible display
- `RECORDING_STARTED` - Audio capture initialized (with file path & timestamp)
- `RECORDING_STOPPED` - User stopped via SIGINT
- `STREAM_ERROR` - ScreenCaptureKit error
- `AUDIO_FILE_CREATION_FAILED` - File I/O error
- `AUDIO_BUFFER_WRITE_FAILED` - Failed to write sample

---

## 2. Electron Integration: Process Management

### Child Process Communication Pattern

**File**: `src/electron/utils/recording.js`

#### Spawning the Swift Binary
```javascript
const { spawn } = require("node:child_process");

let recordingProcess = null;

const initRecording = (filepath, filename) => {
    return new Promise((resolve) => {
        const args = ["--record", filepath];
        if (filename) args.push("--filename", filename);
        
        recordingProcess = spawn("./src/swift/Recorder", args);
        
        recordingProcess.stdout.on("data", (data) => {
            const response = data.toString()
                .split("\n")
                .filter((line) => line !== "")
                .map((line) => JSON.parse(line))
                .at(0);
            
            if (response.code !== "RECORDING_STARTED" && 
                response.code !== "RECORDING_STOPPED") {
                resolve(false);
            } else {
                const timestamp = new Date(response.timestamp).getTime();
                global.mainWindow.webContents.send("recording-status", 
                    response.code === "RECORDING_STARTED" ? "START_RECORDING" : "STOP_RECORDING", 
                    timestamp, 
                    response.path);
                resolve(true);
            }
        });
    });
};
```

**Key Pattern Decisions**:

1. **spawn() over exec()**: 
   - Allows streaming stdout data (needed for real-time responses)
   - Can send SIGINT to gracefully stop recording
   - Better for long-running processes

2. **Retry Loop**:
   ```javascript
   while (true) {
       const recordingStarted = await initRecording(filepath, filename);
       if (recordingStarted) break;
   }
   ```
   - Handles transient failures in stream initialization
   - Automatically retries if --check-permissions says permission denied

3. **Single Process Instance**:
   - Stores in module-level `recordingProcess` variable
   - Only one recording at a time allowed

#### Stopping Recording
```javascript
module.exports.stopRecording = () => {
    if (recordingProcess !== null) {
        recordingProcess.kill("SIGINT");  // Sends SIGINT, not SIGKILL
        recordingProcess = null;
    }
};
```

**Signal Choice**: SIGINT (Ctrl+C equivalent)
- Allows Swift code to catch signal and finalize gracefully
- Flushes audio buffers to disk
- Returns timestamp of stop time
- SIGKILL would abruptly terminate, potentially corrupting file

### Permission Checking Pattern

**File**: `src/electron/utils/permission.js`

```javascript
module.exports.checkPermissions = async () => {
    const { stdout: checkPermissionStdout } = await execAsync("./src/swift/Recorder --check-permissions");
    const { code: checkPermissionCode } = JSON.parse(checkPermissionStdout);
    return checkPermissionCode === "PERMISSION_GRANTED";
};
```

**Implementation Note**: 
- Uses separate invocation of Swift binary with `--check-permissions`
- Avoids spawning recording process if permissions not granted
- Called at app startup and before each recording attempt

---

## 3. IPC Pattern: Main Process <→ Renderer Process Communication

### Architecture: Electron IPC with Channel-Based Messaging

**File**: `src/electron/main.js`

#### Main Process IPC Handlers

```javascript
// 1. File Selection Dialog
ipcMain.on("open-folder-dialog", async (event) => {
    const desktopPath = path.join(os.homedir(), "Desktop");
    const { filePaths, canceled } = await dialog.showOpenDialog(global.mainWindow, {
        properties: ["openDirectory"],
        defaultPath: desktopPath,
    });
    if (!canceled) {
        event.sender.send("selected-folder", filePaths[0]);
    }
});

// 2. Start Recording
ipcMain.on("start-recording", async (_, { filepath, filename }) => {
    await startRecording({ filepath, filename });
});

// 3. Stop Recording
ipcMain.on("stop-recording", () => {
    stopRecording();
});

// 4. Check Permissions (async handler)
ipcMain.handle("check-permissions", async () => {
    const isPermissionGranted = await checkPermissions();
    if (isPermissionGranted) {
        global.mainWindow.loadFile("./src/electron/screens/recording/screen.html");
    } else {
        const response = await dialog.showMessageBox(global.mainWindow, {
            type: "warning",
            title: "Permission Denied",
            message: "Grant permission for screen recording?",
            buttons: ["Open System Preferences", "Cancel"],
        });
        if (response.response === 0) {
            shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
        }
    }
});
```

**Key IPC Patterns**:

1. **One-way `.on()` listeners**:
   - `open-folder-dialog`: Renderer initiates, main handles, responds via `.send()`
   - `start-recording`: Fire-and-forget style
   - `stop-recording`: Simple control signal

2. **Two-way `.handle()` promise-based**:
   - `check-permissions`: Returns boolean to renderer
   - Used for request-response patterns

3. **Reverse channel `.send()`**:
   - `selected-folder`: Main sends folder path to renderer
   - `recording-status`: Main sends recording lifecycle events to renderer

#### Renderer Process IPC Communication

**File**: `src/electron/screens/recording/renderer.js`

```javascript
const { ipcRenderer, shell } = require("electron");

// Request folder selection
document.getElementById("select-folder").addEventListener("click", () => {
    ipcRenderer.send("open-folder-dialog");
});

// Receive selected folder
ipcRenderer.on("selected-folder", (_, path) => {
    selectedFolderPath = path;
    document.getElementById("selected-folder-path").textContent = selectedFolderPath;
});

// Start recording
document.getElementById("start-recording").addEventListener("click", () => {
    ipcRenderer.send("start-recording", {
        filepath: selectedFolderPath,
        filename: recordingFilename,
    });
});

// Stop recording
document.getElementById("stop-recording").addEventListener("click", () => {
    ipcRenderer.send("stop-recording");
});

// Receive recording status updates
ipcRenderer.on("recording-status", (_, status, timestamp, filepath) => {
    if (status === "START_RECORDING") {
        // Update UI: disable inputs, show file path, start timer
        startTime = timestamp;
        updateElapsedTime();
    }
    if (status === "STOP_RECORDING") {
        // Update UI: enable inputs, stop timer
        clearTimeout(updateTimer);
    }
});
```

**UI State Management**:
- Disables controls during recording (prevent concurrent recordings)
- Shows real-time elapsed time counter
- Displays output file path when recording starts
- Allows opening folder in Finder by clicking file path

---

## 4. File I/O & Recording Lifecycle

### File Path Construction

```javascript
const fullPath = path.join(filepath, filename + ".flac");
```

**Rules**:
- Uses user-selected directory from dialog
- Appends `.flac` extension automatically
- Validates file doesn't already exist (prevents overwrites)

### Timeline & Signal Flow

```
Renderer                Main                    Swift Binary
   |                      |                          |
   |--start-recording---->|                          |
   |                      |--spawn("./Recorder")---->|
   |                      |                          |--check args
   |                      |                          |--request permissions
   |                      |                          |--setup display
   |                      |                          |--create FLAC file
   |                      |<--RECORDING_STARTED------| (after 0.5s timeout)
   |<--recording-status---|                          |
   |                      |                          |--stream audio samples
   |                      |                          |--write to FLAC file
   |                      |                          | (continuous)
   |                      |                          |
   |---stop-recording---->|                          |
   |                      |-----SIGINT-------------->|
   |                      |                          |--stop capture
   |                      |                          |--close FLAC file
   |                      |<--RECORDING_STOPPED-----|
   |<--recording-status---|                          |
   |                      |                          |
```

### File Write Implementation

**Audio Buffer → FLAC File**:
```swift
// Called for each audio sample buffer from ScreenCaptureKit
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, 
            of outputType: SCStreamOutputType) {
    guard let audioBuffer = sampleBuffer.asPCMBuffer, sampleBuffer.isValid else { return }
    
    try RecorderCLI.audioFileForRecording?.write(from: audioBuffer)  // Write samples
}
```

**Format Conversion Chain**:
1. ScreenCaptureKit delivers CMSampleBuffer (compressed/encoded format)
2. Extension converts to AVAudioPCMBuffer (raw PCM samples)
3. AVAudioFile handles FLAC encoding and writes to disk
4. Process continues until SIGINT received

**Audio Quality**:
- 48kHz sample rate (professional standard, matches ScreenCaptureKit default)
- 2 channels (stereo) 
- 32-bit float PCM (high precision before FLAC compression)
- Interleaved: false (planar format, separate channel buffers)

---

## 5. Key Architecture Decisions

### Why Swift?

1. **Direct macOS API Access**:
   - ScreenCaptureKit is Apple's modern framework (macOS 13.2+)
   - Not exposed to Node.js native bindings
   - Swift has first-class ScreenCaptureKit support

2. **Audio Sample Processing**:
   - AVFoundation provides mature audio codec/format handling
   - Native support for FLAC encoding
   - Efficient buffer management for continuous audio streams

3. **Permissions Integration**:
   - `CGRequestScreenCaptureAccess()` is C-level API
   - Swift can call directly with nice error handling
   - Shows native macOS permission dialogs

4. **Executable Distribution**:
   - Compiled Swift binary bundles with app
   - No runtime dependency on Swift compiler
   - Simpler than native Node modules (no compilation on customer machines)

### Why Not Use...

- **Electron DesktopCapturer API**: Only captures display video, audio capture broken on macOS
- **ffmpeg/libav**: Would add large binary dependency, requires native bindings
- **Web Audio API**: Cannot access system audio (security sandbox)
- **Node native modules (nan/napi)**: Would need C++ bindings to ScreenCaptureKit (minimal documentation)

### CLI + IPC Pattern Advantages

**vs. Native Module Approach**:
- Process isolation: Crash in Swift binary doesn't crash Electron
- Easier debugging: Can run Swift binary standalone
- Language flexibility: Swift code doesn't need Node.js knowledge
- Binary distribution: Pre-compiled binary in repo, instant install

**vs. Socket/Network Communication**:
- Lower latency (local process)
- No port conflicts
- No security holes (no listening port)
- Simpler cleanup (child process dies with parent)

### Minimal Video Stream Trick

```swift
configuration.width = 2
configuration.height = 2
configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale.max)
```

**Why**:
- ScreenCaptureKit requires a video stream + audio output
- Creating 2x2 video stream is minimal overhead
- App discards all video frames, processes only audio
- Avoids needing to process actual screen content

---

## 6. Code Patterns Worth Adapting

### Pattern 1: Process-Based Native Bridge
```javascript
// Spawn compiled binary, communicate via JSON on stdout
const process = spawn("./path/to/binary", ["--arg", "value"]);
process.stdout.on("data", (data) => {
    const response = JSON.parse(data.toString());
    // Handle response
});
process.kill("SIGINT");  // Graceful shutdown
```

**When to Use**: 
- Need native APIs without Node bindings
- Want process isolation
- Can tolerate IPC overhead

### Pattern 2: Command-Line Arguments for Configuration
```swift
let arguments = CommandLine.arguments
if let recordIndex = arguments.firstIndex(of: "--record") {
    recordingPath = arguments[recordIndex + 1]
}
```

**vs. Environment Variables**: Arguments are more explicit and easier to audit

### Pattern 3: Timeout-Based State Transitions
```swift
DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
    if !self.streamFunctionCalled {
        // Timeout: stream not started
    } else {
        // Stream started successfully
    }
}
```

**Why Useful**: 
- Detects when native APIs fail to initialize
- Distinguishes between startup failure vs. later errors

### Pattern 4: Signal Handlers for Graceful Shutdown
```swift
signal(SIGINT, { signal in
    // Cleanup: close files, flush buffers
    RecorderCLI.terminateRecording()
    ResponseHandler.returnResponse(["code": "RECORDING_STOPPED"])
})
```

**vs. Abrupt Kill**: Ensures audio file is properly finalized

### Pattern 5: Semaphore-Based Process Blocking
```swift
let semaphore = DispatchSemaphore(value: 0)
// Start async operation
DispatchQueue.global().async {
    // Work...
    semaphore.signal()  // Done
}
semaphore.wait()  // Block until done
```

**Use Case**: Keep Swift app running while async ScreenCaptureKit operates

### Pattern 6: JSON Stdout Communication
```swift
if let jsonData = try? JSONSerialization.data(withJSONObject: response),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
    fflush(stdout)  // CRITICAL: Force flush
}
```

**Key**: `fflush(stdout)` ensures parent process reads response immediately

---

## 7. Adaptation Guide for Bridge Prototype

### Phase 1: Minimal Port
```
1. Copy Recorder.swift structure
2. Replace ScreenCaptureKit audio with your input source
3. Keep FLAC file output & command-line interface
4. Keep Electron IPC unchanged
```

### Phase 2: Add Your Features
```
1. Modify audio source: System audio → [Your input]
2. Add new command-line arguments for your options
3. New response codes for your specific states
4. Additional file formats beyond FLAC
```

### Phase 3: Enhanced IPC
```
1. Add progress reporting (samples processed, file size)
2. Stream health metrics (buffer underruns, latency)
3. Configuration updates while recording
```

### Security Considerations
- The app requests screen recording permissions (standard for ScreenCaptureKit)
- All file paths validated before write operations
- No shell injection risk (using spawn with array args)
- Process runs with user privileges (no elevation needed)

---

## Summary: The Brilliant Parts

1. **CLI Binary Bridge**: Cleanest way to access macOS system APIs from Electron
2. **FLAC Format**: Perfect balance of quality, compression, and codec support
3. **ScreenCaptureKit Hack**: Using video capture framework for audio-only recordings
4. **Graceful Shutdown**: SIGINT + signal handlers + proper file finalization
5. **Minimal Electron Integration**: Just spawn, listen to stdout, kill on stop

This is a production-quality pattern for system audio capture on macOS with Electron.
