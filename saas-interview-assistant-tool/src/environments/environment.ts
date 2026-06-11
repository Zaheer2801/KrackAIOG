// Electron (file://): hostname is "". LAN mobile: 192.168.x.x. Web: krackai.org.
const _host = window.location.hostname;
const _isElectron = !_host || window.location.protocol === 'file:';
const _isLocal =
  !_isElectron && (
    _host === 'localhost' ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(_host)
  );

export const environment = {
  production: true,
  apiUrl: _isLocal ? `http://${_host}:3000` : 'https://krackai-api.onrender.com',
  websockerUrl: _isLocal ? `ws://${_host}:3000` : 'wss://krackai-api.onrender.com',
  // ── In-development features (hidden in production builds) ──
  // Voice cloning is PRACTICE / REHEARSAL only. Keep false until fully ready;
  // flip to true ONLY in a local dev build to work on it.
  voiceCloneEnabled: false,
};
