const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

const STORAGE_FOLDER_NAME = 'data';
const MEMORY_FILE_NAME = 'memory.json';
const SETTINGS_FILE_NAME = 'settings.json';

const defaultWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
const defaultHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

const DEFAULT_SETTINGS = {
  scale: 0.5,
  rotation: 0,
  posX: defaultWidth / 2,
  posY: defaultHeight / 2 - 50,
  opacity: 1,
  volume: 1,
  lipSyncSensitivity: 0.5,
};

const appSettings = { ...DEFAULT_SETTINGS };
const chatHistory = [];
const storageDirectory = resolveStorageDirectory();
const memoryFilePath = path.join(storageDirectory, MEMORY_FILE_NAME);
const settingsFilePath = path.join(storageDirectory, SETTINGS_FILE_NAME);

function resolveStorageDirectory() {
  try {
    const userDataPath = ipcRenderer.sendSync('get-app-data-path-sync');
    return ensureDirectory(path.join(userDataPath, STORAGE_FOLDER_NAME));
  } catch (error) {
    console.warn('Electron userData 경로를 가져오지 못해 프로젝트 폴더에 임시 저장합니다:', error);
    return ensureDirectory(path.join(__dirname, '../../..', '.runtime-data'));
  }
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function loadSettings() {
  const parsedSettings = readJsonFile(settingsFilePath, null);

  if (!parsedSettings || typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) {
    normalizeSettings();
    saveSettings();
    return;
  }

  Object.assign(appSettings, parsedSettings);
  migrateLegacySettings(parsedSettings);
  normalizeSettings();
  saveSettings();
}

function migrateLegacySettings(parsedSettings) {
  const isLegacySettings = !Object.prototype.hasOwnProperty.call(parsedSettings, 'opacity')
    && !Object.prototype.hasOwnProperty.call(parsedSettings, 'lipSyncSensitivity');

  if (isLegacySettings && Number(parsedSettings.scale) === 0.4) {
    appSettings.scale = DEFAULT_SETTINGS.scale;
  }

  if (typeof parsedSettings.lipsyncSensitivity === 'number' && typeof parsedSettings.lipSyncSensitivity !== 'number') {
    appSettings.lipSyncSensitivity = parsedSettings.lipsyncSensitivity === 1.5
      ? DEFAULT_SETTINGS.lipSyncSensitivity
      : parsedSettings.lipsyncSensitivity;
  }

  delete appSettings.lipsyncSensitivity;
}

function normalizeSettings() {
  appSettings.scale = snapToStep(clampNumber(appSettings.scale, 0.1, 1, DEFAULT_SETTINGS.scale), 0.05);
  appSettings.rotation = snapToStep(clampNumber(appSettings.rotation, -180, 180, DEFAULT_SETTINGS.rotation), 5);
  appSettings.posX = clampNumber(appSettings.posX, -10000, 10000, DEFAULT_SETTINGS.posX);
  appSettings.posY = clampNumber(appSettings.posY, -10000, 10000, DEFAULT_SETTINGS.posY);
  appSettings.opacity = snapToStep(clampNumber(appSettings.opacity, 0.1, 1, DEFAULT_SETTINGS.opacity), 0.05);
  appSettings.volume = snapToStep(clampNumber(appSettings.volume, 0, 1, DEFAULT_SETTINGS.volume), 0.05);
  appSettings.lipSyncSensitivity = snapToStep(
    clampNumber(appSettings.lipSyncSensitivity, 0.1, 1, DEFAULT_SETTINGS.lipSyncSensitivity),
    0.1,
  );
}

function saveSettings() {
  normalizeSettings();
  writeJsonFile(settingsFilePath, appSettings, '설정 파일 저장 실패');
}

function loadChatHistory() {
  const parsedHistory = readJsonFile(memoryFilePath, []);

  if (Array.isArray(parsedHistory)) {
    chatHistory.length = 0;
    chatHistory.push(...parsedHistory);
  }
}

function saveChatHistory() {
  writeJsonFile(memoryFilePath, chatHistory, '기억 저장 실패');
}

function clearChatHistory() {
  chatHistory.length = 0;
  saveChatHistory();
}

function getCharacterScalePercent() {
  return Math.round(appSettings.scale * 100);
}

function setCharacterScalePercent(value) {
  appSettings.scale = clampPercent(value, 10, 100) / 100;
  saveSettings();
  return getCharacterScalePercent();
}

function getCharacterRotationDegrees() {
  return appSettings.rotation;
}

function setCharacterRotationDegrees(value) {
  appSettings.rotation = snapToStep(clampNumber(value, -180, 180, 0), 5);
  saveSettings();
  return getCharacterRotationDegrees();
}

function getCharacterOpacityPercent() {
  return Math.round(appSettings.opacity * 100);
}

function setCharacterOpacityPercent(value) {
  appSettings.opacity = clampPercent(value, 10, 100) / 100;
  saveSettings();
  return getCharacterOpacityPercent();
}

function getMasterVolumePercent() {
  return Math.round(appSettings.volume * 100);
}

function setMasterVolumePercent(value) {
  appSettings.volume = clampPercent(value, 0, 100) / 100;
  saveSettings();
  return getMasterVolumePercent();
}

function getLipSyncSensitivity() {
  return Number(appSettings.lipSyncSensitivity.toFixed(1));
}

function setLipSyncSensitivity(value) {
  appSettings.lipSyncSensitivity = snapToStep(clampNumber(value, 0.1, 1, 0.5), 0.1);
  saveSettings();
  return getLipSyncSensitivity();
}

function clampPercent(value, min, max) {
  return snapToStep(clampNumber(value, min, max, max), 5);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function snapToStep(value, step) {
  const snapped = Math.round(value / step) * step;
  return Number(snapped.toFixed(4));
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`🚨 JSON 파일 로딩 실패: ${filePath}`, error);
    return fallback;
  }
}

function writeJsonFile(filePath, data, errorLabel) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`🚨 ${errorLabel}:`, error);
  }
}

function getStorageInfo() {
  return {
    storageDirectory,
    memoryFilePath,
    settingsFilePath,
  };
}

loadSettings();
loadChatHistory();

module.exports = {
  appSettings,
  chatHistory,
  saveSettings,
  saveChatHistory,
  clearChatHistory,
  getCharacterScalePercent,
  setCharacterScalePercent,
  getCharacterRotationDegrees,
  setCharacterRotationDegrees,
  getCharacterOpacityPercent,
  setCharacterOpacityPercent,
  getMasterVolumePercent,
  setMasterVolumePercent,
  getLipSyncSensitivity,
  setLipSyncSensitivity,
  getStorageInfo,
};
