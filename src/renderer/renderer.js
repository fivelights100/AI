// Renderer process entry point
const { ipcRenderer } = require('electron');
const { chatHistory } = require('./storage/configManager');
const { initCharacterEngine } = require('./companion/characterEngine');
const { getModelUrl, WAKE_WORD_MODEL_URL } = require('./config/appConfig');
const { processUserMessage } = require('./ai/aiOrchestrator');
const { initWakeWordListener } = require('./speech/sttEngine');
const {
  initUI,
  openDashboard,
  typeSubtitle,
  renderSchedules,
  uiElementsToBlock,
  chatInput,
  inputContainer,
  subtitleBox,
} = require('./ui/uiController');

const modelUrl = getModelUrl();
const wakeWordModelUrl = WAKE_WORD_MODEL_URL;

initUI();

initCharacterEngine(modelUrl, uiElementsToBlock, {
  onSubtitle: typeSubtitle,
  onLoaded: () => {
    const lastAssistantMessage = [...chatHistory].reverse().find((message) => message.role === 'assistant');

    if (lastAssistantMessage) {
      typeSubtitle('다시 만나서 반가워! 언제든 Ctrl + Space를 눌러봐.');
    } else {
      typeSubtitle('우리들의 첫 번째 대화 장소야! 만나서 반가워. Ctrl + Space를 눌러봐.');
    }
  },
  onDragStart: () => typeSubtitle('으차차... 어디로 옮겨줄까?'),
  onDragEnd: () => typeSubtitle('여기가 마음에 들어! 고마워.'),
  onRightClick: () => openDashboard(),
  onHideSettings: () => {},
});

ipcRenderer.on('toggle-chat', () => {
  const isHidden = inputContainer.style.display === 'none' || inputContainer.style.display === '';

  if (isHidden) {
    ipcRenderer.send('set-focusable', true);
    inputContainer.style.display = 'block';
    chatInput.focus();
    ipcRenderer.send('set-ignore-mouse-events', false);
  } else {
    inputContainer.style.display = 'none';
    chatInput.blur();
    ipcRenderer.send('set-focusable', false);
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;

  const userText = chatInput.value.trim();
  if (!userText) return;

  chatInput.value = '';
  subtitleBox.textContent = '생각하는 중...';
  inputContainer.style.display = 'none';
  ipcRenderer.send('set-focusable', false);

  processUserMessage(userText, renderSchedules, typeSubtitle);
});

initWakeWordListener(
  wakeWordModelUrl,
  () => {
    subtitleBox.textContent = '🎙️ 응, 듣고 있어. 말해줘!';
  },
  (transcribedText) => {
    if (transcribedText) {
      subtitleBox.textContent = '생각하는 중...';
      processUserMessage(transcribedText, renderSchedules, typeSubtitle);
    } else {
      typeSubtitle('응? 잘 못 들었어. 다시 말해줄래?');
    }
  },
);
