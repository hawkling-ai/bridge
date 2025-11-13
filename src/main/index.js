const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// Enable Core Audio Tap for macOS 15+ system audio loopback
app.commandLine.appendSwitch('enable-features', 'MacCatapSystemAudioLoopbackCapture');

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

// IPC: Save recording to Documents/Bridge/Recordings/
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
