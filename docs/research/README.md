# Bridge Research: Electron System Audio Recording on macOS

This directory contains comprehensive research and analysis of the electron-system-audio-recorder repository, which provides a production-ready pattern for capturing system audio in Electron applications on macOS.

## Documents

### 1. electron-system-audio-recorder-analysis.md (21KB, 633 lines)
**Comprehensive technical analysis of the implementation**

Covers:
- Swift implementation details (Recorder.swift)
- Electron integration patterns
- IPC communication (main ↔ renderer)
- File I/O and recording lifecycle
- Key architecture decisions
- Code patterns worth adapting

Key sections:
- Swift audio capture using ScreenCaptureKit
- Child process communication pattern
- JSON over stdout IPC
- FLAC audio format implementation
- Graceful shutdown with SIGINT
- Permission management (CGRequestScreenCaptureAccess)

### 2. electron-system-audio-recorder-architecture.md (21KB, 397 lines)
**Visual architecture diagrams and flow charts**

Contains:
- High-level system architecture diagram
- IPC message flow for start/stop recording
- Audio processing pipeline
- Command-line argument parsing
- Error code flowchart
- File system layout
- Key design patterns

### 3. bridge-adaptation-guide.md (15KB, 496 lines)
**Practical guide for adapting the pattern to Bridge**

Includes:
- Executive summary of key takeaways
- Why CLI binary pattern is perfect for Bridge
- ScreenCaptureKit "hack" for system audio
- Implementation roadmap (Phase 1-3)
- Code snippets to adapt
- Common pitfalls to avoid
- Next steps

## Quick Start

1. **Read this first:** `bridge-adaptation-guide.md`
   - Understand why this pattern works for Bridge
   - Review the 3-phase implementation roadmap

2. **Deep dive:** `electron-system-audio-recorder-analysis.md`
   - Study the Swift implementation
   - Understand the IPC patterns
   - Learn the error handling approach

3. **Reference:** `electron-system-audio-recorder-architecture.md`
   - Use diagrams to understand data flow
   - Reference when implementing

## Key Insights

### 1. CLI Binary Bridge Pattern
- Compile Swift to standalone binary
- Spawn from Node.js with `child_process.spawn()`
- Communicate via JSON on stdout/stderr
- No need for Node.js native modules

### 2. ScreenCaptureKit for System Audio
```swift
// The "hack": Use ScreenCaptureKit for audio-only capture
configuration.width = 2                    // Minimal 2x2 video
configuration.capturesAudio = true         // Get system audio
configuration.sampleRate = 48000
```

### 3. FLAC Format
- Lossless compression (50% smaller than WAV)
- Native AVFoundation support
- Professional standard

### 4. Graceful Shutdown
- Use SIGINT, not SIGKILL
- Signal handler in Swift ensures cleanup
- Flushes audio buffers before exit

### 5. Permission Flow
- Check: `CGPreflightScreenCaptureAccess()`
- Request: `CGRequestScreenCaptureAccess()`
- Show native macOS permission dialog

## Implementation Phases

### Phase 1: Minimal Working Prototype (1-2 days)
- Copy Swift structure
- Implement basic recording to FLAC
- Test permissions and IPC

**Deliverable:** Can record system audio to file

### Phase 2: Bridge-Specific Features (2-3 days)
- Real-time audio processing
- Speech API integration
- Enhanced IPC with metrics
- Transcript display

**Deliverable:** Real-time transcription working

### Phase 3: Polish & Optimization (1-2 days)
- Comprehensive error handling
- Performance optimization
- Testing and documentation

**Deliverable:** Production-ready quality

## Reference Implementation

The original repository is at:
https://github.com/O4FDev/electron-system-audio-recorder

Cloned to: `/tmp/electron-system-audio-recorder/`

Key files:
- `/tmp/electron-system-audio-recorder/src/swift/Recorder.swift` (265 lines)
- `/tmp/electron-system-audio-recorder/src/electron/utils/recording.js` (75 lines)
- `/tmp/electron-system-audio-recorder/src/electron/utils/permission.js` (11 lines)
- `/tmp/electron-system-audio-recorder/src/electron/main.js` (76 lines)

## Critical Patterns to Copy

### 1. JSON Response Format
```swift
let response = ["code": "RECORDING_STARTED", "path": path, "timestamp": timestamp]
print(jsonString)
fflush(stdout)  // CRITICAL: Force flush
```

### 2. Spawning Swift Binary
```javascript
const process = spawn("./Recorder", ["--record", path, "--filename", name]);
process.stdout.on("data", (data) => {
    const responses = data.toString().split("\n")
        .filter(line => line !== "")
        .map(line => JSON.parse(line));
});
```

### 3. Graceful Stop
```javascript
process.kill("SIGINT");  // Not SIGKILL!
```

### 4. Audio Processing
```swift
func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer) {
    guard let audioBuffer = sampleBuffer.asPCMBuffer else { return }
    try audioFile?.write(from: audioBuffer)
}
```

## Common Pitfalls

1. Forgetting `fflush(stdout)` in Swift
2. Using SIGKILL instead of SIGINT
3. Not handling multiline JSON on stdout
4. Not checking permissions before recording
5. Blocking main thread with large files

## Next Actions

1. Review the adaptation guide
2. Set up Swift build in Bridge's package.json
3. Implement Phase 1 (minimal prototype)
4. Test on macOS
5. Iterate through Phases 2 and 3

## Resources

- [ScreenCaptureKit Documentation](https://developer.apple.com/documentation/screencapturekit)
- [AVFoundation Audio](https://developer.apple.com/documentation/avfoundation/audio)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
- [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-main)

---

**Generated:** 2025-11-13
**Repository:** O4FDev/electron-system-audio-recorder
**Purpose:** Research for Bridge macOS system audio recording
