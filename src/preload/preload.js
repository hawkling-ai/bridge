const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC API to renderer
contextBridge.exposeInMainWorld('electron', {
  // Microphone recording (WebM)
  saveRecording: async (blob, filename) => {
    const arrayBuffer = await blob.arrayBuffer();
    return ipcRenderer.invoke('save-recording', arrayBuffer, filename);
  },

  // System audio recording (Swift binary → FLAC)
  systemAudio: {
    checkPermissions: () => ipcRenderer.invoke('check-system-audio-permissions'),
    start: (filename) => ipcRenderer.invoke('start-system-audio', filename),
    stop: () => ipcRenderer.invoke('stop-system-audio'),

    // Event listeners
    onStarted: (callback) => ipcRenderer.on('recording-started', (_, data) => callback(data)),
    onStopped: (callback) => ipcRenderer.on('recording-stopped', (_, data) => callback(data)),
    onError: (callback) => ipcRenderer.on('recording-error', (_, message) => callback(message)),
  },
});
