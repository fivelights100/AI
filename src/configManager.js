// src/configManager.js
const fs = require('fs');
const path = require('path');

// 💡 팁: src 폴더 안에 있으므로, 데이터 파일은 한 단계 밖(..)인 메인 폴더에 저장합니다.
const memoryFilePath = path.join(__dirname, '..', 'memory.json');
const settingsFilePath = path.join(__dirname, '..', 'settings.json');

// 전역 설정 객체
let appSettings = {
  scale: 0.4,
  rotation: 0,
  posX: window.innerWidth / 2,
  posY: window.innerHeight / 2 - 50,
  volume: 1.0,
  lipsyncSensitivity: 1.5,
  temperature: 0.7,
  modelType: 'local',
  localFamily: 'gemma4',
  localModel: 'gemma4:e4b',
  cloudProvider: 'gpt',
  cloudApiKey: ''
};

// 장기 기억 배열
let chatHistory = [];

function loadSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8');
      // Object.assign을 사용해 기존 객체의 껍데기를 유지한 채 알맹이만 덮어씌웁니다.
      Object.assign(appSettings, JSON.parse(data)); 
    }
  } catch (error) {
    console.error("🚨 설정 파일 로딩 실패:", error);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(appSettings, null, 2), 'utf-8');
  } catch (error) {
    console.error("🚨 설정 파일 저장 실패:", error);
  }
}

function loadChatHistory() {
  try {
    if (fs.existsSync(memoryFilePath)) {
      const fileData = fs.readFileSync(memoryFilePath, 'utf-8');
      const parsedData = JSON.parse(fileData);
      chatHistory.length = 0; // 기존 배열을 비우고
      chatHistory.push(...parsedData); // 파일 내용을 채워넣습니다.
    }
  } catch (error) {
    console.error("🚨 기억 파일 로딩 실패:", error);
  }
}

function saveChatHistory() {
  try {
    fs.writeFileSync(memoryFilePath, JSON.stringify(chatHistory, null, 2), 'utf-8');
  } catch (e) {
    console.error("🚨 기억 저장 실패:", e);
  }
}

// 최초 모듈 로드 시 설정값과 기억을 한 번 읽어옵니다.
loadSettings();
loadChatHistory();

// 다른 파일에서 쓸 수 있도록 변수와 함수들을 내보냅니다.
module.exports = {
  appSettings,
  chatHistory,
  saveSettings,
  saveChatHistory
};