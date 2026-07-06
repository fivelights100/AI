const { ipcRenderer } = require('electron');
const {
  chatHistory,
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
} = require('../storage/configManager');
const { applyCharacterSettings } = require('../companion/characterEngine');
const { setActiveMasterVolume } = require('../companion/audioPlayer');
const { getSchedules, deleteSchedule } = require('../schedules/scheduleClient');
const { getLedgerEntries, deleteLedgerEntry } = require('../ledger/ledgerClient');
const { fetchServerStatus } = require('../system/serverStatusClient');
const { fetchFileSearchStatus } = require('../files/fileSearchClient');
const { fetchNextFileOpenCandidates, confirmFileOpen } = require('../files/fileOpenClient');
const { getServerBaseUrl, setServerBaseUrl } = require('../config/appConfig');
const { escapeHtml } = require('../shared/html');

const subtitleBox = document.getElementById('subtitle-box');
const inputContainer = document.getElementById('input-container');
const chatInput = document.getElementById('chat-input');
const dashboardOverlay = document.getElementById('unified-dashboard');
const closeDashboardBtn = document.getElementById('close-dashboard');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyListContainer = document.getElementById('history-list-container');
const scheduleListContainer = document.getElementById('schedule-list-container');
const ledgerListContainer = document.getElementById('ledger-list-container');
const systemStatusContainer = document.getElementById('system-status-container');
const serverUrlInput = document.getElementById('server-url-input');
const saveServerUrlBtn = document.getElementById('save-server-url-btn');
const refreshStatusBtn = document.getElementById('refresh-status-btn');
const characterScaleInput = document.getElementById('character-scale-input');
const characterScaleValue = document.getElementById('character-scale-value');
const characterRotationInput = document.getElementById('character-rotation-input');
const characterRotationValue = document.getElementById('character-rotation-value');
const characterOpacityInput = document.getElementById('character-opacity-input');
const characterOpacityValue = document.getElementById('character-opacity-value');
const masterVolumeInput = document.getElementById('master-volume-input');
const masterVolumeValue = document.getElementById('master-volume-value');
const lipSyncSensitivityInput = document.getElementById('lip-sync-sensitivity-input');
const lipSyncSensitivityValue = document.getElementById('lip-sync-sensitivity-value');
const fileOpenModal = document.getElementById('file-open-modal');
const fileOpenMessage = document.getElementById('file-open-message');
const fileOpenCandidateList = document.getElementById('file-open-candidate-list');
const fileOpenSelectedSummary = document.getElementById('file-open-selected-summary');
const fileOpenConfirmBtn = document.getElementById('file-open-confirm-btn');
const fileOpenNextBtn = document.getElementById('file-open-next-btn');
const fileOpenCancelBtn = document.getElementById('file-open-cancel-btn');
const fileOpenCloseBtn = document.getElementById('file-open-close-btn');

const uiElementsToBlock = [
  subtitleBox,
  inputContainer,
  chatInput,
  dashboardOverlay,
  fileOpenModal,
];

let typingTimer = null;
let currentFileOpenCandidate = null;
let currentFileOpenCandidatePage = null;
let currentFileOpenRequestToken = 0;
let fileOpenConfirmInFlight = false;
let fileOpenNextInFlight = false;

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

async function renderLedgerEntries() {
  if (!ledgerListContainer) return;

  ledgerListContainer.innerHTML = '<p>서버에서 가계부를 불러오는 중...</p>';
  const entries = await getLedgerEntries();

  if (!entries.length) {
    ledgerListContainer.innerHTML = '<p>등록된 가계부 기록이 없습니다.</p>';
    return;
  }

  ledgerListContainer.innerHTML = entries.map((entry) => {
    const typeLabel = entry.entry_type === 'income' ? '수입' : '지출';
    const amount = formatCurrency(entry.amount);
    const settledLabel = formatSettlement(entry.is_settled);
    const people = entry.people ? escapeHtml(entry.people) : '-';
    const place = entry.place ? escapeHtml(entry.place) : '-';
    const memo = entry.memo ? escapeHtml(entry.memo) : '-';
    const category = entry.category ? escapeHtml(entry.category) : '미분류';

    return `
      <div class="ledger-item ${entry.entry_type === 'income' ? 'income' : 'expense'}">
        <div class="ledger-item-header">
          <strong>[${typeLabel}] ${amount} · ${category}</strong>
          <span>${entry.entry_date || ''} ${entry.entry_time || ''}</span>
        </div>
        <p>장소: ${place}</p>
        <p>인원: ${people}</p>
        <p>정산: ${settledLabel}</p>
        <p>메모: ${memo}</p>
        <button class="delete-ledger-btn" data-id="${entry.id}">삭제</button>
      </div>
    `;
  }).join('');
}

function formatCurrency(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return '-원';
  return `${number.toLocaleString('ko-KR')}원`;
}

function formatSettlement(value) {
  if (value === true) return '정산 완료';
  if (value === false) return '미정산';
  return '해당 없음';
}

async function renderSystemStatus() {
  if (!systemStatusContainer) return;

  systemStatusContainer.innerHTML = '<p>상태를 확인하는 중...</p>';

  const [serverResult, everythingResult] = await Promise.allSettled([
    fetchServerStatus(),
    fetchFileSearchStatus(),
  ]);

  const serverStatus = serverResult.status === 'fulfilled' ? serverResult.value : null;
  const everythingStatus = everythingResult.status === 'fulfilled'
    ? everythingResult.value
    : { available: false, message: '확인 불가' };

  if (!serverStatus) {
    const errorMessage = serverResult.reason?.message || '서버에 연결할 수 없습니다.';

    systemStatusContainer.innerHTML = `
      ${renderStatusSection('서버', `
        <div class="status-grid">
          ${renderStatusCard('서버 상태', false, '연결 실패')}
          ${renderInfoCard('서버 주소', getServerBaseUrl())}
        </div>
        <p class="status-meta">${escapeHtml(errorMessage)}</p>
      `)}
      ${renderStatusSection('데이터베이스', `
        <div class="status-grid">
          ${renderStatusCard('데이터베이스', false, '서버 연결 후 확인 가능')}
        </div>
      `)}
      ${renderStatusSection('API', `
        <div class="status-grid">
          ${renderStatusCard('OpenAI API', false, '확인 불가')}
          ${renderStatusCard('ElevenLabs API', false, '확인 불가')}
          ${renderStatusCard('Voice ID', false, '확인 불가')}
          ${renderStatusCard('모델 상태', false, '확인 불가')}
          ${renderEverythingStatusCard(everythingStatus)}
        </div>
      `)}
    `;
    return;
  }

  const service = serverStatus.services || {};
  const database = serverStatus.database || {};
  const models = serverStatus.models || {};

  systemStatusContainer.innerHTML = `
    ${renderStatusSection('서버', `
      <div class="status-grid">
        ${renderStatusCard('서버 상태', serverStatus.status === 'ok', serverStatus.status === 'ok' ? '연결됨' : serverStatus.status || '확인 필요')}
        ${renderInfoCard('서버 주소', getServerBaseUrl())}
      </div>
    `)}
    ${renderStatusSection('데이터베이스', `
      <div class="status-grid">
        ${renderStatusCard('데이터베이스', Boolean(database.ok), database.ok ? '연결됨' : database.message || '확인 필요')}
      </div>
    `)}
    ${renderStatusSection('API', `
      <div class="status-grid">
        ${renderStatusCard('OpenAI API', Boolean(service.openai_api_key), service.openai_api_key ? '사용 가능' : '미설정')}
        ${renderStatusCard('ElevenLabs API', Boolean(service.elevenlabs_api_key), service.elevenlabs_api_key ? '사용 가능' : '미설정')}
        ${renderStatusCard('Voice ID', Boolean(service.elevenlabs_voice_id), service.elevenlabs_voice_id ? '설정됨' : '미설정')}
        ${renderStatusCard('모델 상태', Boolean(models.hiyori_runtime), models.hiyori_runtime ? '사용 가능' : '누락')}
        ${renderEverythingStatusCard(everythingStatus)}
      </div>
    `)}
  `;
}

function renderStatusSection(title, body) {
  return `
    <section class="status-section">
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </section>
  `;
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

function renderInfoCard(label, detail) {
  return `
    <div class="status-card neutral">
      <strong>${escapeHtml(label)}</strong>
      <span>정보</span>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function renderEverythingStatusCard(status) {
  const isOk = Boolean(status?.available);
  return renderStatusCard('Everything', isOk, isOk ? '사용 가능' : '사용 불가');
}


function showFileOpenConfirmation(candidate) {
  if (!candidate?.id) return;

  showFileOpenCandidates({
    request_id: 'legacy-single-candidate',
    candidates: [candidate],
    has_more: false,
    next_offset: null,
    page_size: 7,
    message: '열 대상을 선택해 주세요.',
  });
}

function showFileOpenCandidates(page) {
  if (!fileOpenModal || !Array.isArray(page?.candidates) || !page.candidates.length) return;

  currentFileOpenRequestToken += 1;
  const requestToken = currentFileOpenRequestToken;
  fileOpenConfirmInFlight = false;
  fileOpenNextInFlight = false;
  currentFileOpenCandidatePage = page;
  currentFileOpenCandidate = null;

  // 이전 루프의 hidden/selected/disabled/text 상태가 남지 않도록 매번 완전 초기화한다.
  fileOpenModal.classList.add('hidden');

  if (fileOpenMessage) {
    fileOpenMessage.textContent = page.has_more
      ? '열 대상을 선택해 주세요. 원하는 항목이 없으면 다음을 눌러 더 볼 수 있어요.'
      : '열 대상을 선택해 주세요.';
  }

  renderFileOpenCandidateList(page.candidates);
  updateFileOpenSelection(null);

  if (fileOpenConfirmBtn) {
    fileOpenConfirmBtn.textContent = '열기';
    fileOpenConfirmBtn.disabled = true;
  }

  if (fileOpenNextBtn) {
    fileOpenNextBtn.textContent = '다음';
    fileOpenNextBtn.classList.toggle('hidden', !page.has_more);
    fileOpenNextBtn.disabled = !page.has_more;
  }

  // 같은 이벤트 루프에서 닫힘/열림 상태가 충돌하는 것을 피하기 위해 다음 프레임에 표시한다.
  window.requestAnimationFrame(() => {
    if (requestToken !== currentFileOpenRequestToken) return;
    fileOpenModal.classList.remove('hidden');
    ipcRenderer.send('set-focusable', true);
    ipcRenderer.send('set-ignore-mouse-events', false);
  });
}

function renderFileOpenCandidateList(candidates) {
  if (!fileOpenCandidateList) return;

  fileOpenCandidateList.innerHTML = candidates
    .map((candidate) => {
      const typeLabel = candidate.is_folder
        ? '폴더'
        : candidate.category || formatExtensionLabel(candidate.extension);
      const parentPath = candidate.parent_path || getParentPath(candidate.path) || '-';

      return `
        <button class="file-open-candidate-item" type="button" data-candidate-id="${escapeHtml(candidate.id)}">
          <span class="file-open-candidate-name">${escapeHtml(candidate.name || '이름 없음')}</span>
          <span class="file-open-candidate-meta">${escapeHtml(typeLabel)} · ${escapeHtml(parentPath)}</span>
        </button>
      `;
    })
    .join('');
}

function updateFileOpenSelection(candidate) {
  currentFileOpenCandidate = candidate;

  if (fileOpenConfirmBtn) {
    fileOpenConfirmBtn.disabled = !candidate?.id;
  }

  if (fileOpenSelectedSummary) {
    if (!candidate) {
      fileOpenSelectedSummary.textContent = '선택된 항목이 없습니다.';
      return;
    }

    const typeLabel = candidate.is_folder
      ? '폴더'
      : candidate.category || formatExtensionLabel(candidate.extension);
    fileOpenSelectedSummary.textContent = `${typeLabel}을 선택했어요. 열기를 누르면 진행합니다.`;
  }

  if (fileOpenCandidateList) {
    for (const element of fileOpenCandidateList.querySelectorAll('.file-open-candidate-item')) {
      element.classList.toggle('selected', element.dataset.candidateId === candidate?.id);
    }
  }
}

function hideFileOpenConfirmation(message) {
  currentFileOpenRequestToken += 1;
  fileOpenConfirmInFlight = false;
  fileOpenNextInFlight = false;

  if (fileOpenModal) {
    fileOpenModal.classList.add('hidden');
  }

  currentFileOpenCandidate = null;
  currentFileOpenCandidatePage = null;

  if (fileOpenCandidateList) fileOpenCandidateList.innerHTML = '';
  if (fileOpenSelectedSummary) fileOpenSelectedSummary.textContent = '선택된 항목이 없습니다.';
  if (fileOpenConfirmBtn) {
    fileOpenConfirmBtn.disabled = true;
    fileOpenConfirmBtn.textContent = '열기';
  }
  if (fileOpenNextBtn) {
    fileOpenNextBtn.classList.add('hidden');
    fileOpenNextBtn.disabled = true;
    fileOpenNextBtn.textContent = '다음';
  }

  if (message) {
    typeSubtitle(message);
  }

  if (!isDashboardOpen() && inputContainer.style.display !== 'block') {
    ipcRenderer.send('set-focusable', false);
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
}

async function confirmPendingFileOpen() {
  if (!currentFileOpenCandidate?.id || !fileOpenConfirmBtn || fileOpenConfirmInFlight) return;

  const token = currentFileOpenRequestToken;
  const candidate = currentFileOpenCandidate;

  fileOpenConfirmInFlight = true;
  fileOpenConfirmBtn.disabled = true;
  fileOpenConfirmBtn.textContent = '여는 중...';

  try {
    const result = await confirmFileOpen(candidate.id);

    if (token !== currentFileOpenRequestToken) return;

    if (result.ok) {
      hideFileOpenConfirmation(result.message || '열었어.');
    } else {
      fileOpenConfirmInFlight = false;
      typeSubtitle(result.message || '파일/폴더를 열 수 없었어.');
    }
  } catch (error) {
    if (token !== currentFileOpenRequestToken) return;
    fileOpenConfirmInFlight = false;
    console.error('🚨 파일/폴더 열기 확인 실패:', error);
    typeSubtitle('파일/폴더 열기 요청 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (token === currentFileOpenRequestToken && !fileOpenModal?.classList.contains('hidden')) {
      fileOpenConfirmBtn.disabled = fileOpenConfirmInFlight || !currentFileOpenCandidate?.id;
      fileOpenConfirmBtn.textContent = '열기';
    }
  }
}

async function showNextFileOpenCandidates() {
  if (!currentFileOpenCandidatePage?.request_id || currentFileOpenCandidatePage.next_offset == null) return;
  if (!fileOpenNextBtn || fileOpenNextInFlight) return;

  const token = currentFileOpenRequestToken;
  const requestId = currentFileOpenCandidatePage.request_id;
  const nextOffset = currentFileOpenCandidatePage.next_offset;

  fileOpenNextInFlight = true;
  fileOpenNextBtn.disabled = true;
  fileOpenNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextFileOpenCandidates(requestId, nextOffset);

    if (token !== currentFileOpenRequestToken) return;

    if (response.ok && response.candidate_page) {
      showFileOpenCandidates(response.candidate_page);
    } else {
      fileOpenNextInFlight = false;
      typeSubtitle(response.message || '더 보여줄 후보가 없어.');
    }
  } catch (error) {
    if (token !== currentFileOpenRequestToken) return;
    fileOpenNextInFlight = false;
    console.error('🚨 파일/폴더 후보 다음 페이지 조회 실패:', error);
    typeSubtitle('다음 후보를 불러오지 못했어. 서버 상태를 확인해줘.');
  } finally {
    if (token === currentFileOpenRequestToken && !fileOpenModal?.classList.contains('hidden')) {
      fileOpenNextBtn.textContent = '다음';
      fileOpenNextBtn.disabled = fileOpenNextInFlight || !currentFileOpenCandidatePage?.has_more;
    }
  }
}

function getParentPath(pathValue) {
  const rawPath = String(pathValue || '');
  const separatorIndex = Math.max(rawPath.lastIndexOf('\\'), rawPath.lastIndexOf('/'));
  return separatorIndex > 0 ? rawPath.slice(0, separatorIndex) : '';
}

function formatExtensionLabel(extension) {
  return extension ? `.${extension} 파일` : '파일';
}

async function openDashboard() {
  if (!dashboardOverlay) return;

  dashboardOverlay.classList.remove('hidden');
  ipcRenderer.send('set-focusable', true);
  ipcRenderer.send('set-ignore-mouse-events', false);
  renderHistory();
  await Promise.allSettled([renderSchedules(), renderLedgerEntries(), renderSystemStatus()]);
}

function closeDashboard() {
  if (!dashboardOverlay) return;

  dashboardOverlay.classList.add('hidden');
  ipcRenderer.send('set-focusable', false);
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
}

function isDashboardOpen() {
  return Boolean(dashboardOverlay && !dashboardOverlay.classList.contains('hidden'));
}

function clearHistory() {
  clearChatHistory();
  renderHistory();
  typeSubtitle('대화 기록을 비웠어.');
}

function initSettingsControls() {
  bindRangeControl(characterScaleInput, characterScaleValue, getCharacterScalePercent(), '%', (value) => {
    const nextValue = setCharacterScalePercent(value);
    applyCharacterSettings();
    return nextValue;
  });

  bindRangeControl(characterRotationInput, characterRotationValue, getCharacterRotationDegrees(), '°', (value) => {
    const nextValue = setCharacterRotationDegrees(value);
    applyCharacterSettings();
    return nextValue;
  });

  bindRangeControl(characterOpacityInput, characterOpacityValue, getCharacterOpacityPercent(), '%', (value) => {
    const nextValue = setCharacterOpacityPercent(value);
    applyCharacterSettings();
    return nextValue;
  });

  bindRangeControl(masterVolumeInput, masterVolumeValue, getMasterVolumePercent(), '%', (value) => {
    const nextValue = setMasterVolumePercent(value);
    setActiveMasterVolume(nextValue / 100);
    return nextValue;
  });

  bindRangeControl(lipSyncSensitivityInput, lipSyncSensitivityValue, getLipSyncSensitivity(), '', (value) => {
    return setLipSyncSensitivity(Number(value));
  }, 1);
}

function bindRangeControl(input, label, initialValue, suffix, onChange, decimals = 0) {
  if (!input || !label) return;

  updateRangeControl(input, label, initialValue, suffix, decimals);

  input.addEventListener('input', () => {
    const nextValue = onChange(input.value);
    updateRangeControl(input, label, nextValue, suffix, decimals);
  });
}

function updateRangeControl(input, label, value, suffix, decimals = 0) {
  const displayValue = decimals > 0 ? Number(value).toFixed(decimals) : String(Math.round(Number(value)));

  input.value = displayValue;
  label.textContent = `${displayValue}${suffix}`;
}

function initUI() {
  if (serverUrlInput) {
    serverUrlInput.value = getServerBaseUrl();
  }

  initSettingsControls();

  closeDashboardBtn?.addEventListener('click', closeDashboard);
  clearHistoryBtn?.addEventListener('click', clearHistory);

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

  ledgerListContainer?.addEventListener('click', async (event) => {
    if (!event.target.classList.contains('delete-ledger-btn')) return;

    event.target.disabled = true;
    event.target.textContent = '삭제 중...';

    await deleteLedgerEntry(event.target.dataset.id);
    await renderLedgerEntries();
  });

  saveServerUrlBtn?.addEventListener('click', async () => {
    const normalizedUrl = setServerBaseUrl(serverUrlInput?.value);
    if (serverUrlInput) serverUrlInput.value = normalizedUrl;
    typeSubtitle('서버 주소를 저장했어. 앱을 재시작하면 Live2D 모델 주소도 새 설정을 사용해.');
    await Promise.allSettled([renderSchedules(), renderLedgerEntries(), renderSystemStatus()]);
  });

  refreshStatusBtn?.addEventListener('click', renderSystemStatus);

  fileOpenConfirmBtn?.addEventListener('click', confirmPendingFileOpen);
  fileOpenNextBtn?.addEventListener('click', showNextFileOpenCandidates);
  fileOpenCandidateList?.addEventListener('click', (event) => {
    const item = event.target.closest('.file-open-candidate-item');
    if (!item || !currentFileOpenCandidatePage) return;

    const candidate = currentFileOpenCandidatePage.candidates.find((entry) => entry.id === item.dataset.candidateId);
    if (candidate) updateFileOpenSelection(candidate);
  });
  fileOpenCancelBtn?.addEventListener('click', () => hideFileOpenConfirmation('좋아, 열지 않을게.'));
  fileOpenCloseBtn?.addEventListener('click', () => hideFileOpenConfirmation('좋아, 열지 않을게.'));
  fileOpenModal?.addEventListener('click', (event) => {
    if (event.target === fileOpenModal) {
      hideFileOpenConfirmation('좋아, 열지 않을게.');
    }
  });
}


module.exports = {
  initUI,
  openDashboard,
  closeDashboard,
  isDashboardOpen,
  typeSubtitle,
  renderSchedules,
  renderLedgerEntries,
  renderHistory,
  renderSystemStatus,
  showFileOpenConfirmation,
  showFileOpenCandidates,
  uiElementsToBlock,
  chatInput,
  inputContainer,
  subtitleBox,
  dashboardOverlay,
};
