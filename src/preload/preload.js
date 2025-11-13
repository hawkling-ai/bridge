const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal IPC API to renderer
contextBridge.exposeInMainWorld('electron', {
  saveRecording: async (blob, filename) => {
    const arrayBuffer = await blob.arrayBuffer();
    return ipcRenderer.invoke('save-recording', arrayBuffer, filename);
  },
});
