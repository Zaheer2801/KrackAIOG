const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /* ---------- Platform ---------- */
  platform: process.platform, // 'darwin' | 'win32' | 'linux'

  /* ---------- Window Controls ---------- */
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  /* ---------- App Features ---------- */
  loadDashboard: (code) => ipcRenderer.send('load-dashboard', code),

  toggleProtection: async (enable) => {
    try {
      return await ipcRenderer.invoke('toggle-protection', enable);
    } catch {
      return false;
    }
  },

  getAudioSources: async () => {
    try {
      return await ipcRenderer.invoke('get-audio-sources');
    } catch {
      return [];
    }
  },

  requestAudioPermission: async () => {
    try {
      return await ipcRenderer.invoke('request-audio-permission');
    } catch {
      return false;
    }
  },

  requestScreenPermission: async () => {
    try {
      return await ipcRenderer.invoke('request-screen-permission');
    } catch {
      return { ok: true };
    }
  },

  openExternal: async (url) => {
    return ipcRenderer.invoke('open-external', url);
  },

  setOpacity: async (value) => {
    try {
      return await ipcRenderer.invoke('set-opacity', value);
    } catch {
      return null;
    }
  },

  setBehindMode: (enable) => {
    ipcRenderer.send('set-behind-mode', enable);
  },

  onBehindModeChanged: (callback) => {
    ipcRenderer.on('behind-mode-changed', (_e, val) => callback(val));
  },

  /* ---------- Phone Pairing (LAN stealth server) ---------- */
  getStealthInfo: async () => {
    try {
      return await ipcRenderer.invoke('get-stealth-info');
    } catch {
      return null;
    }
  },

  stealthBroadcast: async (data) => {
    try {
      return await ipcRenderer.invoke('stealth-broadcast', data);
    } catch {}
  },

});
