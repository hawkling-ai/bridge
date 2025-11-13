# Adapting electron-system-audio-recorder for Bridge

## Executive Summary

The electron-system-audio-recorder repository provides a production-ready pattern for integrating native macOS APIs with Electron through a **CLI binary bridge** approach. This is the exact pattern Bridge needs for implementing system audio recording on macOS.

---

## Key Takeaways for Bridge

### 1. Architecture Decision: CLI Binary Pattern

**What they do:**
- Compile Swift to standalone binary: `swiftc -o Recorder Recorder.swift`
- Spawn from Node.js: `spawn("./Recorder", ["--record", path])`
- Communicate via JSON on stdout/stderr

**Why this is perfect for Bridge:**
- No need to learn Node.js native modules (nan/napi)
- Can test Swift code independently of Electron
- Process isolation (crash in Swift doesn't crash app)
- Can use ANY native macOS framework (ScreenCaptureKit, AVFoundation, etc.)
- Easy to distribute (pre-compiled binary bundles with app)

### 2. The ScreenCaptureKit "Hack" for System Audio

**Critical Discovery:**
```swift
// ScreenCaptureKit is designed for screen capture, but...
configuration.width = 2                    // Minimal 2x2 video stream
configuration.height = 2
configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale.max)
configuration.capturesAudio = true         // THE GOAL: System audio
configuration.sampleRate = 48000
configuration.channelCount = 2
```

**Why this matters:**
- ScreenCaptureKit is the ONLY way to capture system audio on modern macOS
- Creates minimal video stream to satisfy API requirements
- Discards all video frames, processes only audio
- This is the technique used by professional recording tools

**For Bridge:**
- Use this exact approach for system audio capture
- Can modify audio processing pipeline for Bridge's needs
- Already handles permissions, buffer management, etc.

### 3. IPC Communication Pattern

**Node.js → Swift:**
```javascript
const recordingProcess = spawn("./Recorder", ["--record", filepath, "--filename", filename]);

recordingProcess.stdout.on("data", (data) => {
    const response = JSON.parse(data.toString());
    // Handle: RECORDING_STARTED, RECORDING_STOPPED, errors
});

recordingProcess.kill("SIGINT");  // Graceful shutdown
```

**Swift → Node.js:**
```swift
// Print JSON to stdout, Node reads it
let response = ["code": "RECORDING_STARTED", "path": filePath, "timestamp": timestamp]
if let jsonData = try? JSONSerialization.data(withJSONObject: response),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
    fflush(stdout)  // CRITICAL: Force flush
}
```

**For Bridge:**
- Adopt this exact pattern for Swift ↔ Node communication
- Extend response codes for Bridge-specific states
- Add progress reporting, health metrics, etc.

### 4. Audio File Format: FLAC

**Why FLAC:**
- Lossless compression (unlike MP3/AAC)
- Smaller than WAV (50% compression)
- Supported natively by AVFoundation
- Professional standard for audio archiving

**Implementation:**
```swift
AVAudioFile(forWriting: URL(fileURLWithPath: path),
            settings: [
                AVSampleRateKey: 48000,
                AVNumberOfChannelsKey: 2,
                AVFormatIDKey: kAudioFormatFLAC
            ],
            commonFormat: .pcmFormatFloat32,
            interleaved: false)
```

**For Bridge:**
- Use FLAC for initial prototype
- Can add other formats (WAV, M4A) later
- Consider user preference setting

### 5. Graceful Shutdown via Signal Handlers

**Pattern:**
```swift
// Catch SIGINT from parent process
signal(SIGINT, { signal in
    RecorderCLI.terminateRecording()  // Stop stream, close files
    ResponseHandler.returnResponse(["code": "RECORDING_STOPPED", "timestamp": timestamp])
    exit(0)
})
```

**Why critical:**
- Ensures audio file is properly finalized
- Flushes remaining buffers to disk
- Reports timestamp of stop time
- SIGKILL would corrupt file

**For Bridge:**
- Implement identical signal handling
- Add cleanup for Bridge-specific resources
- Return metadata (duration, file size, etc.)

### 6. Permission Management

**Pattern:**
```swift
// Check if permission already granted
if !CGPreflightScreenCaptureAccess() {
    // Request permission (shows macOS dialog)
    let granted = CGRequestScreenCaptureAccess()
}
```

**Node.js helper:**
```javascript
async function checkPermissions() {
    const { stdout } = await execAsync("./Recorder --check-permissions");
    const { code } = JSON.parse(stdout);
    return code === "PERMISSION_GRANTED";
}
```

**For Bridge:**
- Use at startup to verify permissions
- Show helpful UI if denied (link to System Preferences)
- Consider caching permission state

---

## Implementation Roadmap for Bridge

### Phase 1: Minimal Working Prototype (1-2 days)

**Goal:** Record system audio to FLAC file

1. **Copy Swift structure:**
   - Create `bridge/native/macos/Recorder.swift`
   - Adapt `RecorderCLI` class for Bridge
   - Keep command-line argument parsing
   - Keep JSON response format

2. **Modify audio source:**
   - Use ScreenCaptureKit (same as reference)
   - Keep 2x2 minimal video stream trick
   - Keep 48kHz, 2ch, FLAC format

3. **Build system:**
   - Add npm script: `"swift:make": "swiftc -o native/macos/Recorder native/macos/Recorder.swift"`
   - Test binary works standalone

4. **Electron integration:**
   - Create `electron/utils/recording.js` (copy from reference)
   - Implement spawn() + stdout parsing
   - Add IPC handlers to main.js

5. **Basic UI:**
   - Add "Start Recording" / "Stop Recording" buttons
   - Show file path when recording starts
   - Display elapsed time

**Acceptance Criteria:**
- Can start/stop system audio recording
- FLAC file created and playable
- Permissions handled correctly

### Phase 2: Bridge-Specific Features (2-3 days)

**Goal:** Add real-time audio processing, API integration

1. **Real-time audio pipeline:**
   - Instead of writing directly to file, send audio to processing queue
   - Add audio level metering (peak, RMS)
   - Implement voice activity detection (VAD)

2. **API integration:**
   - Send audio chunks to speech recognition API
   - Return transcript segments via JSON responses
   - Handle API errors gracefully

3. **Enhanced IPC:**
   - Add progress reporting (samples processed, API calls made)
   - Stream health metrics (buffer underruns, latency)
   - Transcript updates in real-time

4. **File management:**
   - Save both FLAC file AND transcript
   - Configurable output directory
   - Automatic cleanup of old recordings

**Acceptance Criteria:**
- Audio processed in real-time
- Transcript displayed as recording progresses
- Both audio + text saved to disk

### Phase 3: Polish & Optimization (1-2 days)

**Goal:** Production-ready quality

1. **Error handling:**
   - Comprehensive error codes for all failure modes
   - User-friendly error messages
   - Automatic recovery from transient failures

2. **Performance:**
   - Optimize buffer sizes for latency vs. throughput
   - Monitor memory usage
   - Profile CPU usage

3. **Testing:**
   - Unit tests for Swift audio processing
   - Integration tests for Electron ↔ Swift IPC
   - Manual testing on different macOS versions

4. **Documentation:**
   - User guide for permissions setup
   - Developer docs for extending the recorder
   - Architecture diagrams

**Acceptance Criteria:**
- No crashes under normal usage
- Clear error messages for all failure modes
- Performance acceptable on older Macs

---

## Code Snippets to Adapt

### Swift: Audio Buffer Processing (Bridge-Specific)

```swift
// Instead of writing directly to file:
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, 
            of outputType: SCStreamOutputType) {
    guard let audioBuffer = sampleBuffer.asPCMBuffer, sampleBuffer.isValid else { return }
    
    // Option 1: Write to file (like reference implementation)
    try RecorderCLI.audioFileForRecording?.write(from: audioBuffer)
    
    // Option 2: Send to processing queue (for Bridge API integration)
    audioProcessingQueue.async {
        // Calculate audio levels
        let peakLevel = calculatePeakLevel(audioBuffer)
        let rmsLevel = calculateRMSLevel(audioBuffer)
        
        // Send to API (pseudo-code)
        if shouldSendToAPI(audioBuffer) {
            let apiResult = sendToSpeechAPI(audioBuffer)
            ResponseHandler.returnResponse([
                "code": "TRANSCRIPT_SEGMENT",
                "text": apiResult.text,
                "confidence": apiResult.confidence,
                "timestamp": Date().timeIntervalSince1970
            ], shouldExitProcess: false)
        }
        
        // Report metrics
        ResponseHandler.returnResponse([
            "code": "AUDIO_METRICS",
            "peak": peakLevel,
            "rms": rmsLevel
        ], shouldExitProcess: false)
    }
}
```

### Node.js: Enhanced IPC Handling

```javascript
const initRecording = (filepath, filename) => {
    return new Promise((resolve, reject) => {
        recordingProcess = spawn("./native/macos/Recorder", [
            "--record", filepath,
            "--filename", filename,
            "--api-key", process.env.SPEECH_API_KEY  // Bridge-specific
        ]);
        
        recordingProcess.stdout.on("data", (data) => {
            const responses = data.toString().split("\n")
                .filter(line => line !== "")
                .map(line => JSON.parse(line));
            
            responses.forEach(response => {
                switch (response.code) {
                    case "RECORDING_STARTED":
                        mainWindow.webContents.send("recording-started", response);
                        resolve(true);
                        break;
                    
                    case "TRANSCRIPT_SEGMENT":
                        // Bridge-specific: Send transcript to UI
                        mainWindow.webContents.send("transcript-update", {
                            text: response.text,
                            confidence: response.confidence,
                            timestamp: response.timestamp
                        });
                        break;
                    
                    case "AUDIO_METRICS":
                        // Bridge-specific: Send audio levels to UI
                        mainWindow.webContents.send("audio-metrics", {
                            peak: response.peak,
                            rms: response.rms
                        });
                        break;
                    
                    case "RECORDING_STOPPED":
                        mainWindow.webContents.send("recording-stopped", response);
                        break;
                    
                    default:
                        console.error("Unknown response code:", response.code);
                        resolve(false);
                }
            });
        });
        
        recordingProcess.stderr.on("data", (data) => {
            console.error("Recorder error:", data.toString());
        });
        
        recordingProcess.on("exit", (code) => {
            if (code !== 0) {
                reject(new Error(`Recorder exited with code ${code}`));
            }
        });
    });
};
```

---

## Critical Files to Reference

### From electron-system-audio-recorder:

1. **`/tmp/electron-system-audio-recorder/src/swift/Recorder.swift`** (265 lines)
   - Complete audio capture implementation
   - Permission handling
   - Signal handlers
   - JSON response format

2. **`/tmp/electron-system-audio-recorder/src/electron/utils/recording.js`** (75 lines)
   - spawn() usage
   - stdout parsing
   - SIGINT handling

3. **`/tmp/electron-system-audio-recorder/src/electron/utils/permission.js`** (11 lines)
   - Permission check pattern

4. **`/tmp/electron-system-audio-recorder/src/electron/main.js`** (76 lines)
   - IPC handler setup
   - Permission flow

### In Bridge repository:

- `/home/joshua/hawkling/bridge/docs/research/electron-system-audio-recorder-analysis.md`
- `/home/joshua/hawkling/bridge/docs/research/electron-system-audio-recorder-architecture.md`
- This file: `/home/joshua/hawkling/bridge/docs/research/bridge-adaptation-guide.md`

---

## Common Pitfalls to Avoid

### 1. Forgetting fflush(stdout)
```swift
print(jsonString)
fflush(stdout)  // REQUIRED! Otherwise Node.js won't receive it immediately
```

### 2. Using SIGKILL instead of SIGINT
```javascript
// WRONG: Corrupts audio file
recordingProcess.kill("SIGKILL");

// RIGHT: Allows cleanup
recordingProcess.kill("SIGINT");
```

### 3. Parsing Multiline stdout
```javascript
// WRONG: Assumes single JSON response
const response = JSON.parse(data.toString());

// RIGHT: Handle multiple newline-delimited JSON objects
const responses = data.toString().split("\n")
    .filter(line => line !== "")
    .map(line => JSON.parse(line));
```

### 4. Not Checking Permissions Before Recording
```javascript
// ALWAYS check first
const isPermissionGranted = await checkPermissions();
if (!isPermissionGranted) {
    // Show error UI, don't try to record
    return;
}
```

### 5. Blocking Main Thread with Large Files
```javascript
// WRONG: Reads entire file synchronously
const data = fs.readFileSync(filePath);

// RIGHT: Use async/streams for large audio files
const stream = fs.createReadStream(filePath);
```

---

## Next Steps

1. **Review the reference implementation:**
   - Read `/tmp/electron-system-audio-recorder/src/swift/Recorder.swift` line by line
   - Understand the ScreenCaptureKit setup
   - Study the signal handler implementation

2. **Set up build system:**
   - Add Swift compilation to Bridge's build process
   - Test that binary can be spawned from Node.js
   - Verify permissions work correctly

3. **Implement Phase 1 (minimal prototype):**
   - Copy Swift structure
   - Implement basic recording
   - Test on macOS

4. **Iterate to Phase 2 and 3:**
   - Add Bridge-specific features
   - Integrate with speech API
   - Polish and optimize

5. **Test on real hardware:**
   - Verify on macOS Sonoma and later
   - Test permission flows
   - Measure performance

---

## Questions to Answer

1. **Audio quality:**
   - Is 48kHz stereo necessary, or can we use mono?
   - Should we support other formats besides FLAC?

2. **API integration:**
   - Which speech recognition API to use?
   - Should audio be sent in real-time or batched?
   - How to handle API rate limits?

3. **Performance:**
   - What's the maximum acceptable latency?
   - How much memory can we use for buffering?
   - Should we downsample audio before sending to API?

4. **User experience:**
   - Should recording start automatically on app launch?
   - How to indicate when audio is being captured?
   - What happens if recording fails mid-session?

---

## Resources

- **ScreenCaptureKit docs:** https://developer.apple.com/documentation/screencapturekit
- **AVFoundation audio:** https://developer.apple.com/documentation/avfoundation/audio
- **Node.js child_process:** https://nodejs.org/api/child_process.html
- **Electron IPC:** https://www.electronjs.org/docs/latest/api/ipc-main

---

This guide provides a complete roadmap for adapting the electron-system-audio-recorder pattern to Bridge's needs. The key insight is that the CLI binary bridge pattern is the right architecture, and the ScreenCaptureKit approach is the only way to capture system audio on modern macOS.
