# Bridge Prototype - Quick Start

## Minimal macOS Audio Recording Prototype

**Total SLOC: 249 lines** (189 JS + 60 HTML)

### Line Count by File
- `main/index.js`: 45 lines (Electron main process)
- `preload/preload.js`: 9 lines (IPC bridge)
- `renderer/renderer.js`: 135 lines (recording logic)
- `renderer/index.html`: 60 lines (UI)

## Setup & Run

```bash
# Install dependencies
npm install

# Run prototype
npm start

# Run with verbose logging
npm run dev
```

## Testing Checklist

### 1. Device Enumeration
- [ ] Click "List Audio Devices" button
- [ ] Check console for microphone and output device list
- [ ] Verify your devices are detected

### 2. Microphone Recording
- [ ] Click "Record Microphone"
- [ ] Allow microphone permission when prompted
- [ ] Speak into microphone for 10 seconds
- [ ] Click "Stop Recording"
- [ ] Check console for file path
- [ ] Verify file exists in `~/Documents/Bridge/Recordings/`
- [ ] Play back file to verify audio quality

### 3. System Audio Recording
- [ ] Open music/video in another app (Spotify, YouTube, etc.)
- [ ] Click "Record System Audio"
- [ ] In picker dialog, select "macOS Audio" or screen option
- [ ] Click "Share" to allow
- [ ] Play audio in other app for 10 seconds
- [ ] Click "Stop Recording"
- [ ] Check console for file path
- [ ] Play back file to verify system audio captured

## Console Output Examples

**Device enumeration:**
```
=== Audio Devices ===
Microphones: ['MacBook Pro Microphone [default]', 'External USB Mic [12345678...]']
Outputs: ['MacBook Pro Speakers [default]']
Total inputs: 2
Total outputs: 1
```

**Recording started:**
```
=== Recording Started ===
Mode: system
Format: WebM/Opus @ 192kbps, 48kHz
========================
```

**Recording stopped:**
```
=== Recording Stopped ===
Mode: system
Duration: 0:15
Size: 0.35 MB
Saving...
Saved to: /Users/joshua/Documents/Bridge/Recordings/recording_system_2025-01-13T14-30-45-123Z.webm
======================
```

## Functional Programming Patterns Used

### Pure Functions
```javascript
const generateFilename = (mode) => `recording_${mode}_${timestamp}.webm`;
const formatDuration = (ms) => `${mins}:${secs}`;
```

### No Classes
All functions are standalone, no OOP.

### Fail-Fast
Zero try/catch blocks - errors bubble to global handler.

### Minimal State
Module-level variables only:
- `mediaRecorder`
- `recordedChunks`
- `audioStream`
- `startTime`

## Validation Success Criteria

✅ Records microphone audio
✅ Records system audio (macOS 13.2+)
✅ Enumerates audio devices
✅ Saves WebM/Opus files
✅ Under 250 SLOC
✅ Functional programming style
✅ Zero try/catch blocks

## Known Limitations

- **Format**: WebM/Opus (not M4A/AAC) - conversion needed for compatibility
- **macOS Version**: Requires 13.2+ for system audio
- **Permission UX**: System audio requires manual picker selection
- **No UI Feedback**: Recording state only visible in console

## Next Steps if Successful

1. **Validate audio quality** - Is WebM/Opus acceptable?
2. **Test on your macOS version** - Does system audio work?
3. **Decide on format** - Need M4A? Add ffmpeg conversion or native addon
4. **Add UI feedback** - Recording state, timer, waveform

## Next Steps if Issues Found

1. **Permission problems** - Check macOS version and flags
2. **Audio quality issues** - Switch to native ScreenCaptureKit addon
3. **Format requirements** - Implement native AVAssetWriter for M4A
4. **Follow PLAN.md** - Implement full native module approach

## Troubleshooting

**System audio not working:**
- Check macOS version: `sw_vers` (need 13.2+)
- For macOS 15+: Flag is enabled in code
- Try selecting different audio source in picker

**No microphone permission prompt:**
- Check System Settings > Privacy & Security > Microphone
- Manually enable for Electron

**DevTools not showing:**
- It's opened by default in `main/index.js` line 18
- Remove that line for production

## File Structure

```
bridge/
├── package.json
├── src/
│   ├── main/
│   │   └── index.js          (45 lines)
│   ├── preload/
│   │   └── preload.js        (9 lines)
│   └── renderer/
│       ├── index.html        (60 lines)
│       └── renderer.js       (135 lines)
└── QUICKSTART.md             (this file)
```
