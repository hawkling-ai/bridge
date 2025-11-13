# Electron System Audio Recorder - Architecture Diagram

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Electron Application                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────┐       ┌──────────────────────────────┐│
│  │    Renderer Process          │       │    Main Process              ││
│  │  (UI & User Interaction)     │       │  (Process Management)        ││
│  │                              │       │                              ││
│  │ ┌──────────────────────────┐ │       │ ┌──────────────────────────┐││
│  │ │ recording/screen.html    │ │<─────┼─│ main.js                  │││
│  │ │                          │ │ IPC  │ │                          │││
│  │ │ [Start Recording]        │ │      │ │ ipcMain.on handlers:    │││
│  │ │ [Stop Recording]         │ │      │ │ - open-folder-dialog   │││
│  │ │ [Select Folder]          │ │      │ │ - start-recording      │││
│  │ │                          │ │      │ │ - stop-recording       │││
│  │ └──────────────────────────┘ │      │ │ - check-permissions    │││
│  │                              │      │ │                          │││
│  │ ┌──────────────────────────┐ │      │ └──────────────────────────┘││
│  │ │ renderer.js              │ │      │ ┌──────────────────────────┐││
│  │ │                          │ │      │ │ utils/                  │││
│  │ │ ipcRenderer.send()       │ │      │ │  - permission.js ─┐     │││
│  │ │ ipcRenderer.on()         │ │      │ │  - recording.js   │     │││
│  │ │                          │ │      │ │                   │     │││
│  │ └──────────────────────────┘ │      │ └───────────────────┼─────┘││
│  │                              │      │                     │       ││
│  └──────────────────────────────┘      └─────────────────────┼───────┘│
│                                                              │        │
│                                        ┌─────────────────────┘        │
│                                        │                              │
│                              ┌─────────▼──────────────────────┐       │
│                              │ child_process.spawn()          │       │
│                              │ "./src/swift/Recorder"         │       │
│                              └─────────────────────────────────┘       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ spawn() + communicate via JSON
                                    │ on stdout/stderr
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Compiled Swift Binary Process                         │
│                   (./src/swift/Recorder executable)                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ RecorderCLI Class                                                  │ │
│  │                                                                    │ │
│  │  1. processCommandLineArguments()                                 │ │
│  │     - Parse --record, --filename, --check-permissions            │ │
│  │                                                                    │ │
│  │  2. executeRecordingProcess()                                     │ │
│  │     ┌─► updateAvailableContent() ──┐                             │ │
│  │     │                                ▼                             │ │
│  │     │   setupRecordingEnvironment()                               │ │
│  │     │     └─► initiateRecording()                                │ │
│  │     │         ┌─────────────────────────────────┐                │ │
│  │     │         │ SCStream Setup                  │                │ │
│  │     │         │  - Configure min 2x2 video     │                │ │
│  │     │         │  - Enable audio capture        │                │ │
│  │     │         │  - Set 48kHz, 2ch, FLAC       │                │ │
│  │     │         │  - Add stream output handler   │                │ │
│  │     │         │  - Start capture               │                │ │
│  │     │         └─────────────────────────────────┘                │ │
│  │     │                                                             │ │
│  │     └─► setupInterruptSignalHandler()                            │ │
│  │         - Catch SIGINT from parent process                       │ │
│  │         - Gracefully stop recording                              │ │
│  │         - Return RECORDING_STOPPED to parent                     │ │
│  │                                                                    │ │
│  │     └─► setupStreamFunctionTimeout()                             │ │
│  │         - 0.5 second timeout                                     │ │
│  │         - Detect if stream failed to initialize                  │ │
│  │         - Send RECORDING_STARTED to parent                       │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ SCStreamDelegate & SCStreamOutput Implementations                 │ │
│  │                                                                    │ │
│  │  stream(_ didOutputSampleBuffer:)                                 │ │
│  │    ▼                                                              │ │
│  │    Receive CMSampleBuffer from ScreenCaptureKit                 │ │
│  │    │                                                             │ │
│  │    ├─► Convert to AVAudioPCMBuffer (via extension)             │ │
│  │    │                                                             │ │
│  │    └─► Write to AVAudioFile (FLAC format)                      │ │
│  │         [Continuous: called N times per second]                │ │
│  │                                                                    │ │
│  │  stream(_ didStopWithError:)                                      │ │
│  │    └─► Handle SCStream errors gracefully                        │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Helper Classes                                                     │ │
│  │                                                                    │ │
│  │  PermissionsRequester                                            │ │
│  │    └─► CGRequestScreenCaptureAccess()                            │ │
│  │        CGPreflightScreenCaptureAccess()                          │ │
│  │                                                                    │ │
│  │  ResponseHandler                                                 │ │
│  │    └─► JSON encode response                                      │ │
│  │        print to stdout                                           │ │
│  │        fflush() to ensure parent reads                           │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ JSON responses on stdout
                                    │
                                    ▼
                         {"code": "PERMISSION_GRANTED"}
                         {"code": "RECORDING_STARTED", "path": "..."}
                         {"code": "RECORDING_STOPPED", "timestamp": "..."}
                         {"code": "AUDIO_BUFFER_WRITE_FAILED"}
```

---

## IPC Message Flow: Start Recording

```
User clicks "Start Recording"
            │
            ▼
Renderer: ipcRenderer.send("start-recording", {filepath, filename})
            │
            ▼
Main: ipcMain.on("start-recording", async (_, {filepath, filename}) => {
      await startRecording({filepath, filename})
    })
            │
            ▼
Main: checkPermissions() 
      → execAsync("./src/swift/Recorder --check-permissions")
      → Swift returns {"code": "PERMISSION_GRANTED"} or {"code": "PERMISSION_DENIED"}
            │
            ├─ If denied: navigate to permission-denied screen
            │
            └─ If granted:
                  │
                  ▼
            Main: recordingProcess = spawn("./src/swift/Recorder", 
                                          ["--record", filepath, "--filename", filename])
                  │
                  ▼
            Swift: processCommandLineArguments()
                  executeRecordingProcess()
                  setupInterruptSignalHandler()
                  setupStreamFunctionTimeout()
                  │
                  ▼ (after 0.5 second timeout)
            Swift: print({"code": "RECORDING_STARTED", "path": "...", "timestamp": "..."})
                  │
                  ▼
            Main: recordingProcess.stdout.on("data", ...) 
                  [receives RECORDING_STARTED]
                  global.mainWindow.webContents.send("recording-status", "START_RECORDING", ...)
                  │
                  ▼
            Renderer: ipcRenderer.on("recording-status", (_, status, timestamp, filepath) => {
                      if (status === "START_RECORDING") {
                        [disable controls, show file path, start timer]
                      }
                    })
```

---

## IPC Message Flow: Stop Recording

```
User clicks "Stop Recording"
            │
            ▼
Renderer: ipcRenderer.send("stop-recording")
            │
            ▼
Main: ipcMain.on("stop-recording", () => {
      stopRecording()
    })
            │
            ▼
Main: recordingProcess.kill("SIGINT")
            │
            ▼
Swift: [signal handler catches SIGINT]
      RecorderCLI.terminateRecording()
      - screenCaptureStream?.stopCapture()
      - close AVAudioFile (flushes buffers)
      │
      ▼
Swift: print({"code": "RECORDING_STOPPED", "timestamp": "..."})
      exit(0)
            │
            ▼
Main: recordingProcess.stdout.on("data", ...) 
      [receives RECORDING_STOPPED]
      global.mainWindow.webContents.send("recording-status", "STOP_RECORDING", ...)
            │
            ▼
Renderer: ipcRenderer.on("recording-status", (_, status, ...) => {
          if (status === "STOP_RECORDING") {
            [enable controls, stop timer]
          }
        })
```

---

## Audio Processing Pipeline

```
┌─────────────────────────────┐
│  ScreenCaptureKit Framework  │
│  (system audio source)       │
└──────────────┬──────────────┘
               │
               │ SCStream delegate callback
               │
               ▼
┌──────────────────────────────────────┐
│ CMSampleBuffer                       │
│ (audio samples + format description) │
└──────────────┬───────────────────────┘
               │
               │ .asPCMBuffer extension
               │ (format conversion)
               │
               ▼
┌──────────────────────────────────────┐
│ AVAudioPCMBuffer                     │
│ (raw PCM audio samples)              │
│ - 48kHz sample rate                  │
│ - 2 channels (stereo)                │
│ - 32-bit float format                │
└──────────────┬───────────────────────┘
               │
               │ write(from:) method
               │
               ▼
┌──────────────────────────────────────┐
│ AVAudioFile (FLAC format)            │
│ - Encodes PCM to FLAC                │
│ - Writes to disk in chunks           │
│ - Maintains sample timing            │
└──────────────┬───────────────────────┘
               │
               │ File I/O
               │
               ▼
┌──────────────────────────────────────┐
│ Disk File: recording.flac            │
│                                      │
│ Lossless compressed audio file       │
│ Ready for playback after close()     │
└──────────────────────────────────────┘
```

---

## Command-Line Argument Parsing

```
Invocation from Node.js:
  spawn("./src/swift/Recorder", ["--record", "/path/to/dir", "--filename", "my-recording"])

Swift parsing:
  let arguments = CommandLine.arguments
  // arguments = ["./src/swift/Recorder", "--record", "/path/to/dir", "--filename", "my-recording"]
  
  if let recordIndex = arguments.firstIndex(of: "--record") {
    recordingPath = arguments[recordIndex + 1]  // "/path/to/dir"
  }
  
  if let filenameIndex = arguments.firstIndex(of: "--filename") {
    recordingFilename = arguments[filenameIndex + 1]  // "my-recording"
  }

File path construction:
  let pathForAudioFile = "\(recordingPath)/\(recordingFilename).flac"
  // Result: "/path/to/dir/my-recording.flac"
```

---

## Error Code Flowchart

```
Process Execution
       │
       ├─ Arguments valid?
       │  └─ NO ──► INVALID_ARGUMENTS
       │
       ├─ --check-permissions flag?
       │  └─ YES ──► Check permission
       │            ├─ Granted? ──► PERMISSION_GRANTED
       │            └─ Denied? ───► PERMISSION_DENIED
       │
       ├─ --record path provided?
       │  └─ NO ──► NO_PATH_SPECIFIED
       │
       ├─ Get available displays
       │  └─ Found? 
       │     └─ NO ──► NO_DISPLAY_FOUND
       │
       ├─ Create FLAC file
       │  └─ Success?
       │     └─ NO ──► AUDIO_FILE_CREATION_FAILED
       │
       ├─ Start audio capture (wait 0.5s)
       │  └─ Stream output called?
       │     ├─ YES ──► RECORDING_STARTED (continue running)
       │     └─ NO ──► STREAM_FUNCTION_NOT_CALLED
       │
       ├─ Process audio buffers
       │  └─ Write succeeds?
       │     └─ NO ──► AUDIO_BUFFER_WRITE_FAILED
       │
       ├─ ScreenCaptureKit error?
       │  └─ YES ──► STREAM_ERROR
       │
       └─ User sends SIGINT
          └─► RECORDING_STOPPED
```

---

## File System Layout

```
electron-system-audio-recorder/
├── src/
│   ├── electron/
│   │   ├── main.js                          ← IPC handlers
│   │   ├── screens/
│   │   │   ├── recording/
│   │   │   │   ├── screen.html               ← Recording UI
│   │   │   │   └── renderer.js               ← UI event handling & IPC
│   │   │   └── permission-denied/
│   │   │       └── screen.html
│   │   └── utils/
│   │       ├── recording.js                 ← spawn(), SIGINT handling
│   │       └── permission.js                ← permission check
│   │
│   └── swift/
│       ├── Recorder.swift                   ← Source code
│       └── Recorder                         ← Compiled binary (git ignored)
│
├── package.json
│   └── scripts:
│       └── "swift:make": "swiftc -o src/swift/Recorder src/swift/Recorder.swift"
│
└── forge.config.js                          ← Electron Forge packaging
```

---

## Key Design Patterns

### 1. Process Isolation
- Swift binary runs in separate process
- Crash doesn't affect Electron main/renderer
- Can be restarted independently

### 2. JSON over stdout
- Simple, language-agnostic
- Parseable in Node.js with single JSON.parse()
- No complex serialization library needed

### 3. Graceful Shutdown (SIGINT)
- Signal handler in Swift allows cleanup
- Flushes audio buffers before exit
- Timestamp indicates when user stopped

### 4. Single Instance
- Only one recording at a time
- Module-level `recordingProcess` variable
- Prevents accidental concurrent recordings

### 5. Retry Logic
- Transient failures retried automatically
- Handles edge cases in stream initialization
- User doesn't need to restart app

### 6. Permission Gates
- Check before starting recording
- Navigate to settings if denied
- Uses native macOS permission dialogs

