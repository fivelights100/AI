// src/characterEngine.js
const { ipcRenderer } = require('electron');
const { appSettings, saveSettings } = require('./configManager');
const { initAudioEngine } = require('./audioEngine');

let app = null;
let modelRef = null;
let isLeftDragging = false;
let longPressTimer = null;
let dragOffset = { x: 0, y: 0 };
let lastIgnoreState = null;

// 🌟 메인에서 캔버스, 모델경로, 마우스를 막아야할 UI들, 그리고 이벤트 콜백을 넘겨받아 조립합니다.
function initCharacterEngine(modelUrl, uiElements, callbacks) {
  app = new PIXI.Application({
    view: document.getElementById('canvas'),
    autoStart: true,
    backgroundAlpha: 0,
    resizeTo: window
  });

  PIXI.live2d.Live2DModel.from(modelUrl).then((model) => {
    modelRef = model;
    app.stage.addChild(model);
    model.scale.set(appSettings.scale);
    model.rotation = appSettings.rotation * (Math.PI / 180);
    model.position.set(appSettings.posX, appSettings.posY);
    model.interactive = true;

    // 오디오 엔진 연결
    initAudioEngine(model, callbacks.onSubtitle);

    // 로딩 완료 신호 전송
    if (callbacks.onLoaded) callbacks.onLoaded();

    // 마우스 이벤트(드래그, 우클릭 등) 감지기 가동
    setupMouseEvents(uiElements, callbacks);
  }).catch(err => console.error("🚨 모델 로딩 실패:", err));
}

// 🌟 거대하고 복잡했던 마우스 물리 엔진을 이쪽으로 완벽 격리!
function setupMouseEvents(uiElements, callbacks) {
  window.addEventListener('mousedown', (event) => {
    // 넘겨받은 UI 요소 중 하나라도 클릭했다면 캐릭터 조작 무시
    const isClickInsideUI = uiElements.some(el => el && el.contains(event.target));
    if (isClickInsideUI) return;

    const hitAreas = modelRef.hitTest(event.clientX, event.clientY);
    const isOverCharacter = hitAreas && hitAreas.length > 0;

    // 좌클릭 길게 누르기 (드래그 시작)
    if (event.button === 0 && isOverCharacter) {
      if (callbacks.onHideSettings) callbacks.onHideSettings();
      longPressTimer = setTimeout(() => {
        isLeftDragging = true;
        dragOffset.x = event.clientX - modelRef.position.x;
        dragOffset.y = event.clientY - modelRef.position.y;
        ipcRenderer.send('set-ignore-mouse-events', false);
        lastIgnoreState = false;
        if (callbacks.onDragStart) callbacks.onDragStart();
      }, 300);
      return;
    }

    // 우클릭 (설정창 열기)
    if (event.button === 2 && isOverCharacter) {
      event.preventDefault();
      ipcRenderer.send('set-ignore-mouse-events', false);
      lastIgnoreState = false;
      if (callbacks.onRightClick) callbacks.onRightClick(event.clientX, event.clientY);
      return;
    }

    // 허공 클릭 시 설정창 닫기
    if (!isOverCharacter) {
      if (callbacks.onHideSettings) callbacks.onHideSettings();
    }
  });

  window.addEventListener('mousemove', (event) => {
    if (!modelRef) return;
    modelRef.focus(event.clientX, event.clientY); // 캐릭터가 마우스를 바라봄

    if (isLeftDragging) {
      modelRef.position.set(event.clientX - dragOffset.x, event.clientY - dragOffset.y);
      return;
    }

    const hitAreas = modelRef.hitTest(event.clientX, event.clientY);
    const isOverCharacter = hitAreas && hitAreas.length > 0;
    const isMouseOverUI = uiElements.some(el => el && el.contains(event.target));
    
    // 캐릭터나 UI 위에 마우스가 있으면 클릭 관통 끄기
    const shouldInteract = isOverCharacter || isMouseOverUI;

    if (shouldInteract) {
      if (lastIgnoreState !== false) {
        ipcRenderer.send('set-ignore-mouse-events', false);
        lastIgnoreState = false;
      }
    } else {
      if (lastIgnoreState !== true) {
        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
        lastIgnoreState = true;
      }
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      clearTimeout(longPressTimer);
      if (isLeftDragging) {
        isLeftDragging = false;
        
        // 이동된 위치 저장
        appSettings.posX = modelRef.position.x;
        appSettings.posY = modelRef.position.y;
        saveSettings();
        
        if (callbacks.onDragEnd) callbacks.onDragEnd();

        const hitAreas = modelRef.hitTest(event.clientX, event.clientY);
        const isOverCharacter = hitAreas && hitAreas.length > 0;
        const isClickInsideUI = uiElements.some(el => el && el.contains(event.target));

        if (!isOverCharacter && !isClickInsideUI) {
          ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
          lastIgnoreState = true;
        }
      }
    }
  });

  window.addEventListener('contextmenu', (e) => { e.preventDefault(); });
}

// 🌟 UI 컨트롤러가 캐릭터를 조종할 수 있게 도와주는 리모콘 함수들
function setModelScale(val) { if (modelRef) modelRef.scale.set(val); }
function setModelRotation(deg) { if (modelRef) modelRef.rotation = deg * (Math.PI / 180); }

module.exports = { initCharacterEngine, setModelScale, setModelRotation };