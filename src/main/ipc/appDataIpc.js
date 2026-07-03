function registerAppDataIpc(ipcMain, app) {
  ipcMain.on('get-app-data-path-sync', (event) => {
    event.returnValue = app.getPath('userData');
  });
}

module.exports = { registerAppDataIpc };
