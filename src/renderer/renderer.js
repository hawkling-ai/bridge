// Module-level state (minimal, functional)
let mediaRecorder = null;
let recordedChunks = [];
let audioStream = null;
let startTime = null;
let audioContext = null;
let analyser = null;
let visualizerInterval = null;
let recordingMode = null; // 'microphone' | 'system'

// Pure function: Generate filename
const generateFilename = (mode, extension = 'webm') =>
  `recording_${mode}_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;

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

// System audio recording (Swift binary → FLAC)
const startSystemAudio = async () => {
  // Check permissions first
  const permissionStatus = await window.electron.systemAudio.checkPermissions();

  if (!permissionStatus.supported) {
    throw new Error(permissionStatus.reason || 'System audio not supported on this platform');
  }

  if (!permissionStatus.granted) {
    throw new Error(
      'Screen Recording permission required. ' +
      'Enable in System Settings > Privacy & Security > Screen Recording'
    );
  }

  // Generate filename for FLAC output
  const filename = generateFilename('system', 'flac');
  recordingMode = 'system';
  startTime = Date.now();

  console.log('\n=== System Audio Recording (Swift) ===');
  console.log('Mode: ScreenCaptureKit → FLAC');
  console.log('Format: 48kHz stereo, lossless');
  console.log('Starting...');

  // Setup event listeners
  window.electron.systemAudio.onStarted((response) => {
    console.log('Recording started:', response);
    console.log('Path:', response.path);
  });

  window.electron.systemAudio.onStopped((response) => {
    const duration = Date.now() - startTime;
    console.log('\n=== Recording Stopped ===');
    console.log('Duration:', formatDuration(duration));
    console.log('Timestamp:', response.timestamp);
    console.log('========================\n');

    recordingMode = null;
    startTime = null;
  });

  window.electron.systemAudio.onError((message) => {
    console.error('Recording error:', message);
    recordingMode = null;
    startTime = null;
  });

  // Start recording via Swift binary
  await window.electron.systemAudio.start(filename);
};

// Microphone recording (WebM)
const startMicrophoneAudio = async () => {
  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
    },
  });

  recordingMode = 'microphone';
  return startRecording('microphone');
};

// Volume visualizer (minimal implementation)
const startVisualizer = () => {
  // Create audio context and analyser
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;

  const source = audioContext.createMediaStreamSource(audioStream);
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Create 16 volume bars
  const volumeBars = document.getElementById('volume-bars');
  volumeBars.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('div');
    bar.className = 'volume-bar';
    volumeBars.appendChild(bar);
  }

  // Show visualizer
  document.getElementById('visualizer').classList.add('active');

  // Update visualizer
  visualizerInterval = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);

    const bars = volumeBars.children;
    for (let i = 0; i < bars.length; i++) {
      const value = dataArray[i * 2] || 0;
      const percent = (value / 255) * 100;
      bars[i].style.height = `${percent}%`;
    }

    // Calculate average volume
    const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    const volumePercent = Math.round((avg / 255) * 100);
    document.getElementById('volume-level').textContent = `Volume: ${volumePercent}%`;
  }, 50);
};

const stopVisualizer = () => {
  if (visualizerInterval) {
    clearInterval(visualizerInterval);
    visualizerInterval = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
  }
  document.getElementById('visualizer').classList.remove('active');
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
    stopVisualizer();
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
    recordedChunks = [];
    startTime = null;
  };

  mediaRecorder.start(1000); // 1 second chunks

  // Start visualizer
  startVisualizer();

  console.log(`\n=== Recording Started ===`);
  console.log('Mode:', mode);
  console.log('Format: WebM/Opus @ 192kbps, 48kHz');
  console.log('========================\n');

  return mediaRecorder;
};

// Stop recording (handles both microphone and system audio)
const stopRecording = async () => {
  if (recordingMode === 'system') {
    // Stop Swift binary recording
    await window.electron.systemAudio.stop();
  } else if (mediaRecorder && mediaRecorder.state === 'recording') {
    // Stop WebM microphone recording
    mediaRecorder.stop();
  } else {
    throw new Error('No active recording');
  }
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

// Setup event listeners (CSP-compliant)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-mic').addEventListener('click', async () => {
    try {
      await startMicrophoneAudio();
    } catch (err) {
      console.error('Microphone error:', err);
      alert(`Failed to start microphone: ${err.message}`);
    }
  });

  document.getElementById('btn-system').addEventListener('click', async () => {
    try {
      await startSystemAudio();
    } catch (err) {
      console.error('System audio error:', err);
      alert(`Failed to start system audio: ${err.message}`);
    }
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    try {
      stopRecording();
    } catch (err) {
      console.error('Stop error:', err);
      alert(`Failed to stop recording: ${err.message}`);
    }
  });

  document.getElementById('btn-devices').addEventListener('click', async () => {
    try {
      await enumerateDevices();
    } catch (err) {
      console.error('Device enumeration error:', err);
      alert(`Failed to enumerate devices: ${err.message}`);
    }
  });

  // Auto-enumerate on load
  console.log('Bridge Audio Recorder loaded');
  enumerateDevices();
});
