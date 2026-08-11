const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Real-time File Watcher IPC
  addWatchFolder: (folderPath) => ipcRenderer.invoke('watcher:add-folder', folderPath),
  removeWatchFolder: (folderPath) => ipcRenderer.invoke('watcher:remove-folder', folderPath),
  getWatchFolders: () => ipcRenderer.invoke('watcher:get-folders'),
  
  onFileChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('watcher:file-changed', handler);
    return () => ipcRenderer.removeListener('watcher:file-changed', handler);
  },

  // Read local file directly from disk (ultra-low latency on Windows/macOS)
  readLocalFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  
  // Tray / Window controls
  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),
  showNotification: (title, body) => ipcRenderer.send('app:notification', { title, body }),
});
