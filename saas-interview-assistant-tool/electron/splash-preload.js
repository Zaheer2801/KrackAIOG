const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  ready: () => ipcRenderer.send('splash:ready'),
});
