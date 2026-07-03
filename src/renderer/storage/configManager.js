const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

const STORAGE_FOLDER_NAME = 'data';
const MEMORY_FILE_NAME = 'memory.json';
const SETTINGS_FILE_NAME = 'settings.json';

const defaultWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
const defaultHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

const appSettings = {
  scale: 0.4,
  rotation: 0,
  posX: defaultWidth / 2,
  posY: defaultHeight / 2 - 50,
  volume: 1.0,
  lipsyncSensitivity: 1.5,
};

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

  if (parsedSettings && typeof parsedSettings === 'object' && !Array.isArray(parsedSettings)) {
    Object.assign(appSettings, parsedSettings);
  }
}

function saveSettings() {
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
  getStorageInfo,
};
