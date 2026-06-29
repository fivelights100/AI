// src/uiController.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcRenderer } = require('electron');

const { appSettings, saveSettings, chatHistory, saveChatHistory } = require('./configManager');
const { setMute, updateVolume } = require('./audioEngine');
const { getSchedules, deleteSchedule } = require('./scheduleManager');
const { setModelScale, setModelRotation } = require('./characterEngine');

// ==========================================
// 1. 화면 요소(DOM) 싹 다 불러오기
// ==========================================
const subtitleBox = document.getElementById('subtitle-box');
const inputContainer = document.getElementById('input-container');
const chatInput = document.getElementById('chat-input');
const settingsPanel = document.getElementById('settings-panel');

const scaleSlider = document.getElementById('scale-slider');
const scaleVal = document.getElementById('scale-val');
const rotationSlider = document.getElementById('rotation-slider');
const rotationVal = document.getElementById('rotation-val');
const opacitySlider = document.getElementById('opacity-slider');
const opacityVal = document.getElementById('opacity-val');
const alwaysTopToggle = document.getElementById('always-top-toggle');

const muteToggle = document.getElementById('mute-toggle');
const volumeSlider = document.getElementById('volume-slider');
const volumeVal = document.getElementById('volume-val');
const lipsyncSlider = document.getElementById('lipsync-slider');
const lipsyncVal = document.getElementById('lipsync-val');

const tempSlider = document.getElementById('temp-slider');
const tempVal = document.getElementById('temp-val');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');

const advancedBtn = document.getElementById('advanced-btn');
const advancedModal = document.getElementById('advanced-modal');
const closeAdvancedBtn = document.getElementById('close-advanced-btn');

const typeLocalRadio = document.getElementById('type-local');
const typeCloudRadio = document.getElementById('type-cloud');
const localSettingsArea = document.getElementById('local-settings-area');
const cloudSettingsArea = document.getElementById('cloud-settings-area');

const localFamilySelect = document.getElementById('local-family-select');
const localModelSelect = document.getElementById('local-model-select');
const cloudProviderSelect = document.getElementById('cloud-provider-select');
const cloudApiKeyInput = document.getElementById('cloud-api-key');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const dashboardBtn = document.getElementById('dashboard-btn');
const dashboardModal = document.getElementById('dashboard-modal');
const closeDashboardBtn = document.getElementById('close-dashboard-btn');
const scheduleTbody = document.getElementById('schedule-tbody');

// 마우스 관통을 막아야 하는 UI 목록
const uiElementsToBlock = [settingsPanel, subtitleBox, advancedModal, dashboardModal, dashboardBtn];

const LOCAL_MODELS_DB = {
  "gemma4": ["gemma4:e4b", "gemma4:e2b"],
  "Llama4": ["llama4:16x17b", "llama4:128x17b"],
  "gpt-oss": ["GPT-OSS:20B", "GPT-OSS:120B"]
};

// ==========================================
// 2. UI 시각적 변화 함수들
// ==========================================
let typingTimer = null;
function typeSubtitle(text) {
  clearInterval(typingTimer);
  subtitleBox.textContent = "";
  let index = 0;
  typingTimer = setInterval(() => {
    if (index < text.length) {
      subtitleBox.textContent += text[index];
      index++;
    } else clearInterval(typingTimer);
  }, 50); 
}

async function renderSchedules() {
  scheduleTbody.innerHTML = '';
  // 데이터가 로딩 중임을 표시 (선택 사항)
  scheduleTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">서버에서 일정을 불러오는 중...</td></tr>';

  const schedules = await getSchedules(); // 서버 통신 대기!
  
  scheduleTbody.innerHTML = ''; // 로딩 메시지 지우기
  
  if (schedules.length === 0) {
    scheduleTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">등록된 일정이 없습니다.</td></tr>';
    return;
  }

  schedules.forEach(sch => {
    const tr = document.createElement('tr');
    // DB 구조체에 맞게 프로퍼티 이름 변경 (date -> event_date, topic -> title 등)
    tr.innerHTML = `
      <td>${sch.event_date || '-'}</td>
      <td>${sch.event_time || '-'}</td>
      <td>${sch.location || '-'}</td>
      <td>${sch.title || '-'}</td>
      <td>-</td>
      <td>-</td>
      <td>${sch.memo || '-'}</td>
      <td><button class="delete-sch-btn" data-id="${sch.id}" style="background:#ff5252; border:none; padding:5px 10px; color:white; border-radius:5px; cursor:pointer;">삭제</button></td>
    `;
    scheduleTbody.appendChild(tr);
  });
}

// ==========================================
// 3. UI 이벤트 및 스위치 초기화 본체
// ==========================================
function initUI() {
  // 앱 시작 시 슬라이더 초기 눈금 맞추기
  scaleSlider.value = appSettings.scale;
  scaleVal.textContent = `${appSettings.scale.toFixed(2)}x`;
  rotationSlider.value = appSettings.rotation;
  rotationVal.textContent = `${appSettings.rotation}°`;
  volumeSlider.value = appSettings.volume;
  volumeVal.textContent = `${Math.round(appSettings.volume * 100)}%`;
  lipsyncSlider.value = appSettings.lipsyncSensitivity;
  lipsyncVal.textContent = appSettings.lipsyncSensitivity.toFixed(1);
  tempSlider.value = appSettings.temperature;
  tempVal.textContent = appSettings.temperature.toFixed(1);

  // 탭 전환 이벤트
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabContents.forEach(content => {
        if (content.id === targetTabId) content.classList.add('active');
        else content.classList.remove('active');
      });
    });
  });

  // 슬라이더 및 버튼 동작 연결
  scaleSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    setModelScale(val); 
    scaleVal.textContent = `${val.toFixed(2)}x`;
    appSettings.scale = val; saveSettings();
  });
  rotationSlider.addEventListener('input', (e) => {
    const deg = parseInt(e.target.value);
    setModelRotation(deg); 
    rotationVal.textContent = `${deg}°`;
    appSettings.rotation = deg; saveSettings();
  });
  opacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('canvas').style.opacity = val; 
    opacityVal.textContent = `${Math.round(val * 100)}%`;
  });
  alwaysTopToggle.addEventListener('change', (e) => { 
    ipcRenderer.send('set-always-on-top', e.target.checked); 
  });
  muteToggle.addEventListener('change', (e) => setMute(e.target.checked));
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    volumeVal.textContent = `${Math.round(val * 100)}%`;
    appSettings.volume = val; saveSettings(); updateVolume(val);
  });
  lipsyncSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    lipsyncVal.textContent = val.toFixed(1);
    appSettings.lipsyncSensitivity = val; saveSettings();
  });
  tempSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    tempVal.textContent = val.toFixed(1);
    appSettings.temperature = val; saveSettings();
  });

  // 기억 관리 (내보내기 / 지우기)
  exportBtn.addEventListener('click', () => {
    const desktopPath = path.join(os.homedir(), 'Desktop', 'AI_동반자_기억백업.txt');
    let backupText = "=== AI 동반자와의 대화 기록 ===\n\n";
    if (chatHistory.length === 0) return typeSubtitle("아직 내보낼 만한 기억이 없는 것 같아!");
    chatHistory.forEach(msg => {
      const role = msg.role === 'user' ? '나' : '동반자';
      backupText += `[${role}]\n${msg.content}\n\n`;
    });
    try {
      fs.writeFileSync(desktopPath, backupText, 'utf-8');
      typeSubtitle("바탕화면에 우리의 기억을 예쁘게 백업해 두었어!");
    } catch (err) { typeSubtitle("앗, 기억을 저장하는 중에 오류가 났어."); }
    settingsPanel.style.display = 'none'; 
  });
  resetBtn.addEventListener('click', () => {
    chatHistory.length = 0; 
    saveChatHistory(); 
    typeSubtitle("내 머릿속이 하얗게 비워졌어... 우리 다시 처음부터 알아갈까?");
    settingsPanel.style.display = 'none';
  });

  // 고급 설정 모달 제어
  advancedBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
    advancedModal.style.display = 'flex';
    ipcRenderer.send('set-focusable', true);
  });
  closeAdvancedBtn.addEventListener('click', () => {
    advancedModal.style.display = 'none';
    ipcRenderer.send('set-focusable', false);
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true }); 
  });

  // 모델 종류 드롭다운 채우기 및 값 동기화
  for (const family in LOCAL_MODELS_DB) {
    const option = document.createElement('option');
    option.value = option.textContent = family;
    localFamilySelect.appendChild(option);
  }
  localFamilySelect.value = appSettings.localFamily;
  
  function updateModels(family) {
    localModelSelect.innerHTML = '';
    (LOCAL_MODELS_DB[family] || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = m;
      localModelSelect.appendChild(opt);
    });
  }
  updateModels(appSettings.localFamily);
  localModelSelect.value = appSettings.localModel;
  cloudProviderSelect.value = appSettings.cloudProvider;
  cloudApiKeyInput.value = appSettings.cloudApiKey;

  if (appSettings.modelType === 'cloud') {
    typeCloudRadio.checked = true;
    localSettingsArea.classList.remove('active');
    cloudSettingsArea.classList.add('active');
  }

  [typeLocalRadio, typeCloudRadio].forEach(r => r.addEventListener('change', (e) => {
    appSettings.modelType = e.target.value; saveSettings();
    if (appSettings.modelType === 'local') {
      localSettingsArea.classList.add('active'); cloudSettingsArea.classList.remove('active');
    } else {
      localSettingsArea.classList.remove('active'); cloudSettingsArea.classList.add('active');
    }
  }));
  localFamilySelect.addEventListener('change', (e) => {
    appSettings.localFamily = e.target.value;
    updateModels(e.target.value);
    appSettings.localModel = LOCAL_MODELS_DB[e.target.value][0]; 
    saveSettings();
  });
  localModelSelect.addEventListener('change', (e) => { appSettings.localModel = e.target.value; saveSettings(); });
  cloudProviderSelect.addEventListener('change', (e) => { appSettings.cloudProvider = e.target.value; saveSettings(); });
  cloudApiKeyInput.addEventListener('input', (e) => { appSettings.cloudApiKey = e.target.value; saveSettings(); });

  // 대시보드(통합 메뉴) 제어
  scheduleTbody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-sch-btn')) {
    e.target.textContent = '삭제 중...'; // 사용자 시각적 피드백
    e.target.disabled = true;

    // 서버에 삭제 요청을 보내고 끝날 때까지 기다림 (await)
    await deleteSchedule(e.target.getAttribute('data-id'));
    
    // 삭제가 반영된 클라우드의 최신 데이터를 다시 불러와서 그림 (await)
    await renderSchedules();
  }
});
  dashboardBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
    advancedModal.style.display = 'none';
    dashboardModal.style.display = 'flex';
    ipcRenderer.send('set-focusable', true);
    renderSchedules(); 
  });
  closeDashboardBtn.addEventListener('click', () => {
    dashboardModal.style.display = 'none';
    ipcRenderer.send('set-focusable', false);
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true }); 
  });
}

module.exports = {
  initUI, typeSubtitle, renderSchedules, uiElementsToBlock, 
  chatInput, inputContainer, subtitleBox, settingsPanel
};