const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  clipboard,
  protocol,
  shell,
  globalShortcut,
  Tray,
  Menu,
} = require('electron');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');


let mainWindow;
let splashWindow;
let tray = null;
let isQuitting = false;
let protectionEnabled = true;
let pendingDeepLink = null;
let isBehindMode = false;
// Strict hide: once user manually hides, NOTHING auto-shows it — only hotkey or tray "Show" click
let isManuallyHidden = false;

// ── Local stealth server for phone pairing over LAN ──
let stealthServer = null;
let stealthPort = null;
// sessionId → [{ question, answer, timestamp }]
const stealthAnswers = new Map();

function getLanIp() {
  const ifaces = os.networkInterfaces();
  // Prefer WiFi (en0 on Mac, Wi-Fi on Win), then any non-internal IPv4
  const preferred = ['en0', 'en1', 'Wi-Fi', 'wlan0', 'wlan1'];
  for (const name of preferred) {
    const iface = ifaces[name];
    if (!iface) continue;
    const found = iface.find(i => (i.family === 'IPv4' || i.family === 4) && !i.internal);
    if (found) return found.address;
  }
  // Fallback: any non-internal IPv4
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) return iface.address;
    }
  }
  return null;
}

function buildStealthPage(sessionId) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KrackAI Stealth</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; color: #e5e5e5; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; padding: 1rem; }
    #status { font-size: 0.72rem; color: #6b7280; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #22d3ee; flex-shrink: 0; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    #answers { display: flex; flex-direction: column; gap: 1rem; }
    .card { background: #111; border: 1px solid #1f2937; border-radius: 12px; padding: 1rem; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .q-label { font-size: 0.68rem; color: #4b5563; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
    .answer { font-size: 1rem; line-height: 1.7; color: #e5e5e5; white-space: pre-wrap; }
    #empty { color: #4b5563; text-align: center; margin-top: 4rem; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div id="status"><div class="dot"></div><span id="status-text">Live — waiting for answers</span></div>
  <div id="answers"><p id="empty">Waiting for answers from laptop…</p></div>
  <script>
    const sessionId = ${JSON.stringify(sessionId)};
    const baseUrl = location.origin;
    let lastTime = 0;
    let emptyEl = document.getElementById('empty');
    const answersEl = document.getElementById('answers');
    const statusText = document.getElementById('status-text');
    const cards = new Map();

    function cleanText(raw) {
      return (raw || '')
        .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
        .replace(/\\*(.*?)\\*/g, '$1')
        .replace(/^- /gm, '\\u2022 ')
        .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, '[code block]')
        .trim();
    }

    function upsertCard(question, answer) {
      const key = question || '__noq__';
      if (cards.has(key)) {
        cards.get(key).textContent = cleanText(answer);
        return;
      }
      if (emptyEl) { emptyEl.remove(); emptyEl = null; }
      const card = document.createElement('div');
      card.className = 'card';
      if (question) {
        const ql = document.createElement('div');
        ql.className = 'q-label';
        ql.textContent = question;
        card.appendChild(ql);
      }
      const aEl = document.createElement('div');
      aEl.className = 'answer';
      aEl.textContent = cleanText(answer);
      card.appendChild(aEl);
      answersEl.insertBefore(card, answersEl.firstChild);
      cards.set(key, aEl);
    }

    let failCount = 0;
    async function poll() {
      try {
        const res = await fetch(baseUrl + '/answers/' + sessionId + '?since=' + lastTime);
        if (res.ok) {
          const data = await res.json();
          for (const item of data.answers) {
            upsertCard(item.question, item.answer);
            if (item.timestamp > lastTime) lastTime = item.timestamp;
          }
          failCount = 0;
          statusText.textContent = 'Live \\u2014 ' + (cards.size > 0 ? cards.size + ' answer(s)' : 'waiting for answers');
        }
      } catch(e) {
        failCount++;
        if (failCount > 3) statusText.textContent = 'Connection issue \\u2014 retrying...';
      }
      setTimeout(poll, 2000);
    }

    poll();
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
  </script>
</body>
</html>`;
}

function startStealthServer() {
  // Already running — return resolved promise with existing port
  if (stealthServer && stealthPort) return Promise.resolve(stealthPort);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');

      const reqUrl = req.url || '/';

      if (reqUrl.startsWith('/stealth/')) {
        const sessionId = reqUrl.replace('/stealth/', '').split('?')[0];
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildStealthPage(sessionId));

      } else if (reqUrl.startsWith('/answers/')) {
        const parts = reqUrl.replace('/answers/', '').split('?');
        const sessionId = parts[0];
        const query = parts[1] || '';
        const since = parseInt(query.replace(/.*since=(\d+).*/, '$1') || '0') || 0;
        const answers = (stealthAnswers.get(sessionId) || []).filter(a => a.timestamp > since);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ answers }));

      } else {
        res.writeHead(404);
        res.end();
      }
    });

    // Port 0 = OS picks a free port automatically
    server.listen(0, '0.0.0.0', () => {
      stealthServer = server;
      stealthPort = server.address().port;
      console.log(`[KrackAI] Stealth server ready on port ${stealthPort}`);
      resolve(stealthPort);
    });

    server.on('error', (err) => {
      console.error('[KrackAI] Stealth server error:', err.message);
      stealthServer = null;
      stealthPort = null;
      reject(err);
    });
  });
}

const HOTKEY        = 'Control+Alt+K';
const BEHIND_HOTKEY = 'Control+Alt+B';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', (_event, commandLine) => {
  const deepLink = commandLine.find((arg) => arg.startsWith('krackai://'));
  if (deepLink) handleDeepLink(deepLink);
  // Never auto-show if user manually hid the window
  if (mainWindow && !isManuallyHidden) {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('open-url', (event, urlStr) => {
  event.preventDefault();
  handleDeepLink(urlStr);
  // Never auto-show if user manually hid the window
  if (mainWindow && !isManuallyHidden) {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  }
});

app.setAsDefaultProtocolClient('krackai');
protocol.registerSchemesAsPrivileged([
  { scheme: 'krackai', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

app.commandLine.appendSwitch('enable-features', 'AudioServiceSandbox');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#0d0d0d',
    resizable: true,
    show: false,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  mainWindow.setContentProtection(protectionEnabled);

  // Set solid dark background — prevents transparent rendering bug on macOS Sonoma
  if (process.platform === 'darwin') {
    mainWindow.setBackgroundColor('#0d0d0d');
    mainWindow.setOpacity(1.0);
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'PrintScreen' ||
      (input.control && input.key.toLowerCase() === 'p') ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    ) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'audioCapture', 'desktopCapture', 'display-capture', 'screen'].includes(permission));
  });

  // Main window stays hidden until splash signals it's done
  mainWindow.once('ready-to-show', () => {
    if (process.platform === 'darwin') {
      const screenStatus = systemPreferences.getMediaAccessStatus('screen');
      if (screenStatus !== 'granted') {
        console.log('[KrackAI] Screen recording permission not granted.');
      }
    }
    // If no splash (e.g. dev reload), show immediately
    if (!splashWindow || splashWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ALWAYS start by loading the static marketing landing page
  const landingPath = url.pathToFileURL(
    path.join(__dirname, '../../index.html')
  ).href;
  mainWindow.loadURL(landingPath);

  if (pendingDeepLink) {
    mainWindow.loadURL(pendingDeepLink);
    pendingDeepLink = null;
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 500,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function createTray() {
  let iconPath;
  if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, '../icons/icon_32.png');
  } else if (process.env.NODE_ENV === 'development') {
    iconPath = path.join(__dirname, '../public/favicon.ico');
  } else {
    iconPath = path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/favicon.ico');
  }

  tray = new Tray(iconPath);
  tray.setToolTip('KrackAI — running in background');

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Show KrackAI',
      click: () => {
        if (!mainWindow) return;
        isManuallyHidden = false;
        isBehindMode = false;
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.setOpacity(1.0);
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit KrackAI',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(buildMenu());

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      isManuallyHidden = true;
      mainWindow.hide();
    } else {
      isManuallyHidden = false;
      isBehindMode = false;
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setOpacity(1.0);
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function handleDeepLink(urlStr) {
  if (
    !urlStr.startsWith('krackai://success') &&
    !urlStr.startsWith('krackai://cancel') &&
    !urlStr.startsWith('krackai://dashboard')
  ) {
    return;
  }

  const targetUrl =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:4200/#/dashboard'
      : url.pathToFileURL(
          path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/index.html'),
        ).href + '#/dashboard';

  if (mainWindow) {
    mainWindow.loadURL(targetUrl);
  } else {
    pendingDeepLink = targetUrl;
  }
}

function checkForUpdates() {
  const currentVersion = app.getVersion(); // e.g. "1.0.8"
  const options = {
    hostname: 'api.github.com',
    path: '/repos/Zaheer2801/krackai-releases/releases/latest', // public repo — accessible without auth
    headers: { 'User-Agent': 'KrackAI-App' },
  };
  https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latest = (release.tag_name || '').replace(/^v/, ''); // e.g. "1.0.9"
        if (!latest) return;
        const toNum = (v) => v.split('.').map(Number).reduce((a, n, i) => a + n * Math.pow(1000, 2 - i), 0);
        if (toNum(latest) > toNum(currentVersion)) {
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `KrackAI v${latest} is available`,
            detail: `You're on v${currentVersion}. Download the latest version to get new features and fixes.`,
            buttons: ['Download Now', 'Later'],
            defaultId: 0,
          }).then(({ response }) => {
            if (response === 0) {
              shell.openExternal(`https://github.com/Zaheer2801/krackai-releases/releases/tag/v${latest}`);
            }
          });
        }
      } catch {}
    });
  }).on('error', () => {});
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  createSplash();
  createWindow();   // build main window in background (hidden)
  createTray();
  setTimeout(checkForUpdates, 5000); // check 5s after launch

  const startupArg = process.argv.find((arg) => arg.startsWith('krackai://'));
  if (startupArg) setTimeout(() => handleDeepLink(startupArg), 500);

  globalShortcut.register(HOTKEY, () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      // User manually hiding — set the flag so nothing auto-shows it
      isManuallyHidden = true;
      mainWindow.hide();
    } else {
      // User manually showing — clear the flag
      isManuallyHidden = false;
      isBehindMode = false;
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setOpacity(1.0);
      mainWindow.webContents.send('behind-mode-changed', false);
      mainWindow.show();
      mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Ctrl+Alt+B — toggle BEHIND mode from anywhere, even when KrackAI is click-through
  globalShortcut.register(BEHIND_HOTKEY, () => {
    if (!mainWindow) return;
    isBehindMode = !isBehindMode;
    mainWindow.setIgnoreMouseEvents(isBehindMode, { forward: true });
    mainWindow.setOpacity(isBehindMode ? 0.85 : 1.0);
    mainWindow.webContents.send('behind-mode-changed', isBehindMode);
    if (!isBehindMode) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

});

app.on('will-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (tray) { tray.destroy(); tray = null; }
});

app.on('window-all-closed', () => {});

// Splash signals it has finished animating — show main window
ipcMain.on('splash:ready', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Click-through + auto-opacity: called by BEHIND button in the renderer
ipcMain.on('set-behind-mode', (_e, enable) => {
  isBehindMode = enable;
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enable, { forward: true });
    mainWindow.setOpacity(enable ? 0.85 : 1.0);
  }
});

// Load Angular Dashboard
ipcMain.on('load-dashboard', (_e, code) => {
  if (!mainWindow) return;
  const suffix = code ? `?code=${encodeURIComponent(code)}` : '';
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(`http://localhost:4200${suffix}`);
  } else {
    const indexPath = url.pathToFileURL(
      path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/index.html')
    ).href;
    mainWindow.loadURL(`${indexPath}${suffix}`);
  }
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    // DO NOT use mainWindow.maximize() — it disables the transparency compositor on
    // Windows and triggers fullscreen mode on macOS, both of which break transparency.
    // Instead, manually set bounds to the display's work area.
    const { screen } = require('electron');
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    const { x, y, width, height } = display.workArea;
    mainWindow.setBounds({ x, y, width, height });
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('toggle-protection', (_e, enable) => {
  protectionEnabled = enable;
  if (mainWindow) mainWindow.setContentProtection(enable);
  return enable;
});

ipcMain.handle('request-audio-permission', async () => {
  try {
    if (process.platform === 'darwin') {
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      if (micStatus !== 'granted') {
        const granted = await systemPreferences.askForMediaAccess('microphone');
        if (!granted) {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
          return { ok: false };
        }
      }
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
});

ipcMain.handle('request-screen-permission', async () => {
  try {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen');
      if (status !== 'granted') {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        return { ok: false, status, message: 'Screen Recording permission required. Enable KrackAI in System Settings → Privacy → Screen Recording, then restart.' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
});

ipcMain.handle('get-audio-sources', async () => {
  try {
    return await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 400, height: 300 },
    });
  } catch {
    return [];
  }
});

ipcMain.handle('open-external', async (_e, targetUrl) => {
  if (!targetUrl?.startsWith('https://checkout.stripe.com/')) {
    throw new Error('Blocked external navigation');
  }
  await shell.openExternal(targetUrl);
  return true;
});


ipcMain.handle('set-opacity', (_e, value) => {
  if (!mainWindow) return;
  // Clamp between 0.2 and 1.0
  const clamped = Math.min(1.0, Math.max(0.2, Number(value)));
  mainWindow.setOpacity(clamped);
  return clamped;
});

// ── Stealth phone pairing (LAN) ──
ipcMain.handle('get-stealth-info', async () => {
  try {
    const port = await startStealthServer();
    const lanIp = getLanIp();
    return { lanIp, port };
  } catch (err) {
    console.error('[KrackAI] Stealth server failed to start:', err.message);
    return { lanIp: null, port: null };
  }
});

const MAX_STEALTH_SESSIONS = 20;     // keep only the most recent sessions in memory
const MAX_ANSWERS_PER_SESSION = 100; // cap answers per session
const MAX_FIELD_LEN = 20000;         // cap individual question/answer length

ipcMain.handle('stealth-broadcast', (_e, payload) => {
  // Validate input from renderer — reject malformed or oversized payloads
  if (!payload || typeof payload !== 'object') return;
  let { sessionId, question, answer } = payload;
  if (typeof sessionId !== 'string' || !sessionId) return;
  sessionId = sessionId.slice(0, 100);
  question = (typeof question === 'string' ? question : '').slice(0, MAX_FIELD_LEN);
  answer = (typeof answer === 'string' ? answer : '').slice(0, MAX_FIELD_LEN);

  if (!stealthAnswers.has(sessionId)) {
    // Evict oldest session if at capacity — prevents unbounded Map growth
    if (stealthAnswers.size >= MAX_STEALTH_SESSIONS) {
      const oldestKey = stealthAnswers.keys().next().value;
      stealthAnswers.delete(oldestKey);
    }
    stealthAnswers.set(sessionId, []);
  }
  const session = stealthAnswers.get(sessionId);
  const existing = session.find(a => a.question === question);
  if (existing) {
    existing.answer = answer;
    existing.timestamp = Date.now();
  } else {
    if (session.length >= MAX_ANSWERS_PER_SESSION) session.shift(); // drop oldest answer
    session.push({ question, answer, timestamp: Date.now() });
  }
});

if (process.env.NODE_ENV === 'development') {
  app.on('certificate-error', (event, _wc, _url, _error, _cert, callback) => {
    event.preventDefault();
    callback(true);
  });
}
