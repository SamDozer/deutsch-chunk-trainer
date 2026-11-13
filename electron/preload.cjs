const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chunkAPI', {
  getChunks: () => ipcRenderer.invoke('data:chunks'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  exportState: () => ipcRenderer.invoke('state:export'),
  importState: () => ipcRenderer.invoke('state:import'),
  resetState: () => ipcRenderer.invoke('state:reset'),
  openDataFolder: () => ipcRenderer.invoke('shell:open-data-folder'),
  appInfo: () => ipcRenderer.invoke('app:info'),
});
