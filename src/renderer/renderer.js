// Module-level state (minimal, functional)
let mediaRecorder = null;
let recordedChunks = [];
let audioStream = null;
let startTime = null;

// Pure function: Generate filename
const generateFilename = (mode) =>
  `recording_${mode}_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

// Pure function: Format duration
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Device enumeration (fail-fast, no try/catch)
const enumerateDevices = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();

  const audioInputs = devices.filter(d => d.kind === 'audioinput');
  const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

  console.log('\n=== Audio Devices ===');
  console.log('Microphones:', audioInputs.map(d => `${d.label} [${d.deviceId.slice(0, 8)}...]`));
  console.log('Outputs:', audioOutputs.map(d => `${d.label} [${d.deviceId.slice(0, 8)}...]`));
  console.log('Total inputs:', audioInputs.length);
  console.log('Total outputs:', audioOutputs.length);

  return { audioInputs, audioOutputs };
};

// System audio recording (macOS)
const startSystemAudio = async () => {
  audioStream = await navigator.mediaDevices.getDisplayMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
    },
    video: false,
  });

  return startRecording('system');
};

// Microphone recording
const startMicrophoneAudio = async () => {
  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
    },
  });

  return startRecording('microphone');
};

// Generic recording function (functional, reusable)
const startRecording = (mode) => {
  recordedChunks = [];
  startTime = Date.now();

  mediaRecorder = new MediaRecorder(audioStream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 192000,
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const filename = generateFilename(mode);
    const duration = Date.now() - startTime;

    console.log(`\n=== Recording Stopped ===`);
    console.log('Mode:', mode);
    console.log('Duration:', formatDuration(duration));
    console.log('Size:', `${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('Saving...');

    const filepath = await window.electron.saveRecording(blob, filename);

    console.log('Saved to:', filepath);
    console.log('======================\n');

    // Cleanup
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
    recordedChunks = [];
    startTime = null;
  };

  mediaRecorder.start(1000); // 1 second chunks

  console.log(`\n=== Recording Started ===`);
  console.log('Mode:', mode);
  console.log('Format: WebM/Opus @ 192kbps, 48kHz');
  console.log('========================\n');

  return mediaRecorder;
};

// Stop recording (fail-fast)
const stopRecording = () => {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    throw new Error('No active recording');
  }
  mediaRecorder.stop();
};

// Global error handler (fail-fast display)
window.addEventListener('unhandledrejection', (e) => {
  console.error('Error:', e.reason);
  alert(`Recording failed: ${e.reason.message}`);
});

// Export API
window.audioRecorder = {
  enumerateDevices,
  startSystemAudio,
  startMicrophoneAudio,
  stopRecording,
};

// Auto-enumerate on load
console.log('Bridge Audio Recorder loaded');
enumerateDevices();
