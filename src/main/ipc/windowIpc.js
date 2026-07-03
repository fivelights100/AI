function registerWindowIpc(ipcMain, win) {
  ipcMain.on('set-ignore-mouse-events', (_event, ignore, options) => {
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(Boolean(ignore), options);
  });

  ipcMain.on('set-focusable', (_event, focusable) => {
    if (!win || win.isDestroyed()) return;
    win.setFocusable(Boolean(focusable));
    if (focusable) win.focus();
  });

  ipcMain.on('set-always-on-top', (_event, isAlwaysOnTop) => {
    if (!win || win.isDestroyed()) return;
    win.setAlwaysOnTop(Boolean(isAlwaysOnTop));
  });
}

module.exports = { registerWindowIpc };
