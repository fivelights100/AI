// renderer.js (마스터 컨트롤러)
const { ipcRenderer } = require('electron');
const { chatHistory } = require('./src/configManager');
const { initCharacterEngine } = require('./src/characterEngine');
const { processUserMessage } = require('./src/aiOrchestrator');
const { 
  initUI, typeSubtitle, renderSchedules, uiElementsToBlock, 
  chatInput, inputContainer, subtitleBox, settingsPanel 
} = require('./src/uiController');

const modelUrl = './models/hiyori_ex/runtime/hiyori_free_t08.model3.json';

// ==========================================
// 1. UI의 모든 버튼, 슬라이더, 창 껍데기 제어 엔진 가동
// ==========================================
initUI();

// ==========================================
// 2. 캐릭터 그래픽 및 물리 엔진 가동
// ==========================================
initCharacterEngine(modelUrl, uiElementsToBlock, {
  onSubtitle: typeSubtitle,
  onLoaded: () => {
    const lastAssistantMessage = [...chatHistory].reverse().find(m => m.role === 'assistant');
    if (chatHistory.length > 0 && lastAssistantMessage) {
      typeSubtitle(`다시 만나서 반가워! 언제든 Ctrl + Space를 눌러봐.`);
    } else {
      typeSubtitle("우리들의 첫 번째 대화 장소야! 만나서 반가워. Ctrl + Space를 눌러봐.");
    }
  },
  onDragStart: () => typeSubtitle("으차차... 어디로 옮겨줄까?"),
  onDragEnd: () => typeSubtitle("여기가 마음에 들어! 고마워."),
  onRightClick: (x, y) => {
    settingsPanel.style.left = `${x + 15}px`;
    settingsPanel.style.top = `${y - 30}px`;
    settingsPanel.style.display = 'flex';
  },
  onHideSettings: () => settingsPanel.style.display = 'none'
});

// ==========================================
// 3. 채팅창 열고 닫기 (단축키 제어)
// ==========================================
ipcRenderer.on('toggle-chat', () => {
  if (inputContainer.style.display === 'none' || inputContainer.style.display === '') {
    ipcRenderer.send('set-focusable', true); 
    inputContainer.style.display = 'block';
    chatInput.focus();
    ipcRenderer.send('set-ignore-mouse-events', false);
  } else {
    inputContainer.style.display = 'none';
    chatInput.blur();
    ipcRenderer.send('set-focusable', false); 
  }
});

// ==========================================
// 4. 대화 입력 감지 (AI 두뇌 엔진으로 전송)
// ==========================================
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const userText = chatInput.value.trim();
    if (userText) {
      chatInput.value = "";
      subtitleBox.textContent = "생각하는 중...";
      inputContainer.style.display = 'none';
      ipcRenderer.send('set-focusable', false);
      
      // 🌟 입력받은 텍스트를 두뇌 엔진(Orchestrator)에 넘기고 결과를 기다립니다.
      processUserMessage(userText, renderSchedules, typeSubtitle);
    }
  }
});