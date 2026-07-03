const { ipcRenderer } = require('electron');
const { chatHistory } = require('../storage/configManager');
const { getSchedules, deleteSchedule } = require('../schedules/scheduleClient');
const { fetchServerStatus } = require('../system/serverStatusClient');
const { getServerBaseUrl, setServerBaseUrl } = require('../config/appConfig');
const { escapeHtml } = require('../shared/html');

const subtitleBox = document.getElementById('subtitle-box');
const inputContainer = document.getElementById('input-container');
const chatInput = document.getElementById('chat-input');
const dashboardBtn = document.getElementById('dashboard-btn');
const dashboardOverlay = document.getElementById('unified-dashboard');
const closeDashboardBtn = document.getElementById('close-dashboard');
const historyListContainer = document.getElementById('history-list-container');
const scheduleListContainer = document.getElementById('schedule-list-container');
const systemStatusContainer = document.getElementById('system-status-container');
const serverUrlInput = document.getElementById('server-url-input');
const saveServerUrlBtn = document.getElementById('save-server-url-btn');
const refreshStatusBtn = document.getElementById('refresh-status-btn');

const uiElementsToBlock = [
  subtitleBox,
  inputContainer,
  chatInput,
  dashboardBtn,
  dashboardOverlay,
];

let typingTimer = null;

function typeSubtitle(text) {
  clearInterval(typingTimer);
  if (!subtitleBox) return;

  subtitleBox.textContent = '';

  let index = 0;
  typingTimer = setInterval(() => {
    if (index < text.length) {
      subtitleBox.textContent += text[index++];
    } else {
      clearInterval(typingTimer);
    }
  }, 35);
}

function renderHistory() {
  if (!historyListContainer) return;

  if (!chatHistory.length) {
    historyListContainer.innerHTML = '<p>아직 대화 기록이 없습니다.</p>';
    return;
  }

  historyListContainer.innerHTML = chatHistory
    .slice(-50)
    .map((message) => `
      <div class="history-item">
        <strong>${message.role === 'user' ? '나' : '히요리'}</strong>
        <p>${escapeHtml(message.content)}</p>
      </div>
    `)
    .join('');
}

async function renderSchedules() {
  if (!scheduleListContainer) return;

  scheduleListContainer.innerHTML = '<p>서버에서 일정을 불러오는 중...</p>';
  const schedules = await getSchedules();

  if (!schedules.length) {
    scheduleListContainer.innerHTML = '<p>등록된 일정이 없습니다.</p>';
    return;
  }

  scheduleListContainer.innerHTML = schedules.map((schedule) => `
    <div class="schedule-item">
      <strong>${escapeHtml(schedule.title || '제목 없음')}</strong>
      <p>${schedule.event_date || ''} ${schedule.event_time || ''}</p>
      <p>${escapeHtml(schedule.location || '')}</p>
      <p>${escapeHtml(schedule.memo || '')}</p>
      <button class="delete-sch-btn" data-id="${schedule.id}">삭제</button>
    </div>
  `).join('');
}

async function renderSystemStatus() {
  if (!systemStatusContainer) return;

  systemStatusContainer.innerHTML = '<p>서버 상태를 확인하는 중...</p>';

  try {
    const status = await fetchServerStatus();
    const service = status.services || {};

    systemStatusContainer.innerHTML = `
      <div class="status-grid">
        ${renderStatusCard('서버', status.status === 'ok', status.status || 'unknown')}
        ${renderStatusCard('데이터베이스', status.database?.ok, status.database?.message || 'unknown')}
        ${renderStatusCard('OpenAI 키', service.openai_api_key, service.openai_api_key ? '설정됨' : '미설정')}
        ${renderStatusCard('ElevenLabs 키', service.elevenlabs_api_key, service.elevenlabs_api_key ? '설정됨' : '미설정')}
        ${renderStatusCard('ElevenLabs Voice', service.elevenlabs_voice_id, service.elevenlabs_voice_id ? '설정됨' : '미설정')}
        ${renderStatusCard('Live2D 모델', status.models?.hiyori_runtime, status.models?.hiyori_runtime ? '확인됨' : '누락')}
      </div>
      <p class="status-meta">서버 시간: ${escapeHtml(status.server_time || '-')}</p>
    `;
  } catch (error) {
    systemStatusContainer.innerHTML = `
      <div class="status-card danger">
        <strong>서버 연결 실패</strong>
        <p>${escapeHtml(error.message)}</p>
        <p>현재 주소: ${escapeHtml(getServerBaseUrl())}</p>
      </div>
    `;
  }
}

function renderStatusCard(label, isOk, detail) {
  const className = isOk ? 'ok' : 'danger';
  const badge = isOk ? '정상' : '확인 필요';

  return `
    <div class="status-card ${className}">
      <strong>${escapeHtml(label)}</strong>
      <span>${badge}</span>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

async function openDashboard() {
  if (!dashboardOverlay) return;

  dashboardOverlay.classList.remove('hidden');
  ipcRenderer.send('set-focusable', true);
  ipcRenderer.send('set-ignore-mouse-events', false);
  renderHistory();
  await Promise.allSettled([renderSchedules(), renderSystemStatus()]);
}

function closeDashboard() {
  if (!dashboardOverlay) return;

  dashboardOverlay.classList.add('hidden');
  ipcRenderer.send('set-focusable', false);
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
}

function initUI() {
  if (serverUrlInput) {
    serverUrlInput.value = getServerBaseUrl();
  }

  dashboardBtn?.addEventListener('click', openDashboard);
  closeDashboardBtn?.addEventListener('click', closeDashboard);

  dashboardOverlay?.addEventListener('click', (event) => {
    if (event.target === dashboardOverlay) {
      closeDashboard();
    }
  });

  scheduleListContainer?.addEventListener('click', async (event) => {
    if (!event.target.classList.contains('delete-sch-btn')) return;

    event.target.disabled = true;
    event.target.textContent = '삭제 중...';

    await deleteSchedule(event.target.dataset.id);
    await renderSchedules();
  });

  saveServerUrlBtn?.addEventListener('click', async () => {
    const normalizedUrl = setServerBaseUrl(serverUrlInput?.value);
    if (serverUrlInput) serverUrlInput.value = normalizedUrl;
    typeSubtitle('서버 주소를 저장했어. 앱을 재시작하면 Live2D 모델 주소도 새 설정을 사용해.');
    await Promise.allSettled([renderSchedules(), renderSystemStatus()]);
  });

  refreshStatusBtn?.addEventListener('click', renderSystemStatus);
}

module.exports = {
  initUI,
  openDashboard,
  closeDashboard,
  typeSubtitle,
  renderSchedules,
  renderHistory,
  renderSystemStatus,
  uiElementsToBlock,
  chatInput,
  inputContainer,
  subtitleBox,
  dashboardOverlay,
};
