const { ipcRenderer } = require('electron');
const { appSettings, saveSettings } = require('../storage/configManager');

const MOUTH_PARAM_ID = 'ParamMouthOpenY';
const LONG_PRESS_DELAY_MS = 300;

let pixiApp = null;
let modelRef = null;
let isDragging = false;
let longPressTimer = null;
let dragOffset = { x: 0, y: 0 };
let lastIgnoreState = null;
let lipSyncVolume = 0;

function initCharacterEngine(modelUrl, uiElements = [], callbacks = {}) {
  pixiApp = new PIXI.Application({
    view: document.getElementById('canvas'),
    autoStart: true,
    backgroundAlpha: 0,
    resizeTo: window,
  });

  PIXI.live2d.Live2DModel.from(modelUrl)
    .then((model) => {
      modelRef = model;
      pixiApp.stage.addChild(model);

      applySavedTransform(model);
      setupMouseEvents(uiElements, callbacks);
      startLipSyncTicker();

      callbacks.onLoaded?.();
    })
    .catch((error) => {
      console.error('🚨 모델 로딩 실패:', error);
      callbacks.onSubtitle?.('Live2D 모델을 불러오지 못했어. 서버 모델 경로를 확인해줘.');
    });
}

function applySavedTransform(model) {
  model.scale.set(appSettings.scale);
  model.rotation = degreesToRadians(appSettings.rotation);
  model.position.set(appSettings.posX, appSettings.posY);
  model.interactive = true;
}

function setupMouseEvents(uiElements, callbacks) {
  window.addEventListener('mousedown', (event) => {
    if (!modelRef || isUiTarget(event.target, uiElements)) return;

    const isOverCharacter = hitTest(event.clientX, event.clientY);

    if (event.button === 0 && isOverCharacter) {
      startDragAfterLongPress(event, callbacks);
      return;
    }

    if (event.button === 2 && isOverCharacter) {
      event.preventDefault();
      setMousePassthrough(false);
      callbacks.onRightClick?.(event.clientX, event.clientY);
      return;
    }

    callbacks.onHideSettings?.();
  });

  window.addEventListener('mousemove', (event) => {
    if (!modelRef) return;

    modelRef.focus(event.clientX, event.clientY);

    if (isDragging) {
      modelRef.position.set(event.clientX - dragOffset.x, event.clientY - dragOffset.y);
      return;
    }

    const shouldInteract = hitTest(event.clientX, event.clientY) || isUiTarget(event.target, uiElements);
    setMousePassthrough(!shouldInteract);
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;

    clearTimeout(longPressTimer);

    if (!isDragging || !modelRef) return;

    isDragging = false;
    persistPosition();
    callbacks.onDragEnd?.();

    const shouldInteract = hitTest(event.clientX, event.clientY) || isUiTarget(event.target, uiElements);
    setMousePassthrough(!shouldInteract);
  });

  window.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

function startDragAfterLongPress(event, callbacks) {
  callbacks.onHideSettings?.();

  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    if (!modelRef) return;

    isDragging = true;
    dragOffset = {
      x: event.clientX - modelRef.position.x,
      y: event.clientY - modelRef.position.y,
    };

    setMousePassthrough(false);
    callbacks.onDragStart?.();
  }, LONG_PRESS_DELAY_MS);
}

function startLipSyncTicker() {
  pixiApp.ticker.add(() => {
    applyMouthOpen(lipSyncVolume);
  });
}

function updateLipSync(volume) {
  lipSyncVolume = clamp01(Number(volume) || 0);
  applyMouthOpen(lipSyncVolume);
}

function applyMouthOpen(volume) {
  if (!modelRef) return;

  const value = clamp01(volume);
  modelRef.internalModel.coreModel.setParameterValueById(MOUTH_PARAM_ID, value);
}

function persistPosition() {
  appSettings.posX = modelRef.position.x;
  appSettings.posY = modelRef.position.y;
  saveSettings();
}

function hitTest(x, y) {
  const hitAreas = modelRef?.hitTest(x, y);
  return Array.isArray(hitAreas) && hitAreas.length > 0;
}

function isUiTarget(target, uiElements) {
  return uiElements.some((element) => element && element.contains(target));
}

function setMousePassthrough(shouldIgnore) {
  if (lastIgnoreState === shouldIgnore) return;

  ipcRenderer.send('set-ignore-mouse-events', shouldIgnore, shouldIgnore ? { forward: true } : undefined);
  lastIgnoreState = shouldIgnore;
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

module.exports = {
  initCharacterEngine,
  updateLipSync,
};
