const { BrowserWindow, screen } = require('electron');
const path = require('path');

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    focusable: false,
    hasShadow: false,
    type: 'toolbar',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  win.setContentProtection(false);
  win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  win.setIgnoreMouseEvents(true, { forward: true });

  if (process.env.ELECTRON_OPEN_DEVTOOLS === '1' && !win.isDestroyed()) {
    win.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed()) {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }

  return win;
}

module.exports = { createMainWindow };
