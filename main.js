const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');

// 🌟 [핵심 해결책 1] 다이렉트 컴포지션을 비활성화하여 투명 레이어가 하위 GPU 영상 파이프라인을 간섭하지 못하게 차단합니다.
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  const win = new BrowserWindow({
    width: width,        
    height: height,  
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    focusable: false, 
    
    // 🌟 [핵심 해결책 2] 창 그림자 연산을 제거하여 투명도 연산 오버헤드와 레이어 잠금 현상을 방지합니다.
    hasShadow: false, 
    
    // 🌟 [핵심 해결책 3] 창 타입을 일반 앱이 아닌 'toolbar' 시스템 레이어로 지정합니다.
    // 이렇게 하면 윈도우 DWM이 이 창을 전체화면 게임/앱 최적화 대상에서 완전히 제외하여 뒤쪽 영상을 끄지 않습니다.
    type: 'toolbar', 
    
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  win.setContentProtection(false); // 영상 출력 보호 간섭 해제
  win.loadFile('index.html');
  win.setIgnoreMouseEvents(true, { forward: true });

  // 마우스 관통 신호 수신
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    win.setIgnoreMouseEvents(ignore, options);
  });

  // 동적 포커스 허용/차단 신호 수신
  ipcMain.on('set-focusable', (event, focusable) => {
    win.setFocusable(focusable);
    if (focusable) {
      win.focus();
    }
  });

  // 항상 위(Always on top) 토글 신호 수신
  ipcMain.on('set-always-on-top', (event, isAlwaysOnTop) => {
    win.setAlwaysOnTop(isAlwaysOnTop);
  });

  // 글로벌 단축키 대화창 토글
  globalShortcut.register('CommandOrControl+Space', () => {
    win.webContents.send('toggle-chat');
  });

  win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});