const { app, ipcMain, globalShortcut } = require('electron');
const { createMainWindow } = require('./window/createMainWindow');
const { registerWindowIpc } = require('./ipc/windowIpc');
const { registerAppDataIpc } = require('./ipc/appDataIpc');

// 투명 Electron 오버레이가 Windows DWM/GPU 영상 파이프라인을 방해하지 않도록 유지합니다.
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let mainWindow = null;

function registerGlobalShortcuts(win) {
  globalShortcut.register('CommandOrControl+Space', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('toggle-chat');
    }
  });
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  registerWindowIpc(ipcMain, mainWindow);
  registerAppDataIpc(ipcMain, app);
  registerGlobalShortcuts(mainWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
