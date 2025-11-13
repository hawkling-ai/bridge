const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const audioBridge = require('./audio-bridge');

// Enable Core Audio Tap for macOS 15+ system audio loopback (fallback for web APIs)
app.commandLine.appendSwitch('enable-features', 'MacCatapSystemAudioLoopbackCapture');

// Track active recording sessions
let activeRecorder = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 700,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.openDevTools(); // Debug console
};

// IPC: Check system audio permissions (macOS)
ipcMain.handle('check-system-audio-permissions', async () => {
  if (process.platform !== 'darwin') {
    return { supported: false, reason: 'Only macOS is supported' };
  }

  try {
    const granted = await audioBridge.checkPermissions();
    return { supported: true, granted };
  } catch (error) {
    return { supported: true, granted: false, error: error.message };
  }
});

// IPC: Start system audio recording (Swift binary)
ipcMain.handle('start-system-audio', async (event, filename) => {
  if (process.platform !== 'darwin') {
    throw new Error('System audio recording only supported on macOS');
  }

  if (activeRecorder) {
    throw new Error('Recording already in progress');
  }

  const recordingsDir = path.join(app.getPath('documents'), 'Bridge', 'Recordings');
  await fs.mkdir(recordingsDir, { recursive: true });

  const filepath = path.join(recordingsDir, filename);

  activeRecorder = await audioBridge.startRecording(filepath);

  // Forward events to renderer
  activeRecorder
    .on('start', (response) => {
      event.sender.send('recording-started', response);
    })
    .on('stop', (response) => {
      event.sender.send('recording-stopped', response);
      activeRecorder = null;
    })
    .on('error', (error) => {
      event.sender.send('recording-error', error.message);
      activeRecorder = null;
    });

  return { filepath, started: true };
});

// IPC: Stop system audio recording
ipcMain.handle('stop-system-audio', async () => {
  if (!activeRecorder) {
    throw new Error('No active recording');
  }

  activeRecorder.stop();
  return { stopping: true };
});

// IPC: Save microphone recording (WebM from renderer)
ipcMain.handle('save-recording', async (_, arrayBuffer, filename) => {
  const buffer = Buffer.from(arrayBuffer);
  const recordingsDir = path.join(app.getPath('documents'), 'Bridge', 'Recordings');

  await fs.mkdir(recordingsDir, { recursive: true });

  const filepath = path.join(recordingsDir, filename);
  await fs.writeFile(filepath, buffer);

  return filepath;
});

// Lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
