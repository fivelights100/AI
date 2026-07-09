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
const { renderSystemStatus } = require('./statusView');
const { initFilesystemSettingsView, renderFilesystemSettings } = require('./filesystemSettingsView');
const { initFileOpenModal, showFileOpenConfirmation, showFileOpenCandidates } = require('./fileOpenModal');
const { initFileRenameModal, showFileRenameCandidates } = require('./fileRenameModal');
const { initFileCreateModal, showFileCreateCandidates } = require('./fileCreateModal');
const { initFileContentEditModal, showFileContentEditCandidates } = require('./fileContentEditModal');
const { initFileDeleteModal, showFileDeleteCandidates } = require('./fileDeleteModal');
const { initFileTransferModal, showFileTransferCandidates } = require('./fileTransferModal');
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
const fileRenameModal = document.getElementById('file-rename-modal');
const fileRenameConfirmModal = document.getElementById('file-rename-confirm-modal');
const fileCreateModal = document.getElementById('file-create-modal');
const fileCreateConfirmModal = document.getElementById('file-create-confirm-modal');
const fileContentEditModal = document.getElementById('file-content-edit-modal');
const fileContentEditConfirmModal = document.getElementById('file-content-edit-confirm-modal');
const fileDeleteModal = document.getElementById('file-delete-modal');
const fileDeleteConfirmModal = document.getElementById('file-delete-confirm-modal');
const fileTransferSourceModal = document.getElementById('file-transfer-source-modal');
const fileTransferDestinationModal = document.getElementById('file-transfer-destination-modal');
const fileTransferConfirmModal = document.getElementById('file-transfer-confirm-modal');
const filesystemTermsModal = document.getElementById('filesystem-terms-modal');
const filesystemDeleteWarningModal = document.getElementById('filesystem-delete-warning-modal');

const uiElementsToBlock = [
  subtitleBox,
  inputContainer,
  chatInput,
  dashboardOverlay,
  fileOpenModal,
  fileRenameModal,
  fileRenameConfirmModal,
  fileCreateModal,
  fileCreateConfirmModal,
  fileContentEditModal,
  fileContentEditConfirmModal,
  fileDeleteModal,
  fileDeleteConfirmModal,
  fileTransferSourceModal,
  fileTransferDestinationModal,
  fileTransferConfirmModal,
  filesystemTermsModal,
  filesystemDeleteWarningModal,
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



async function openDashboard() {
  if (!dashboardOverlay) return;

  dashboardOverlay.classList.remove('hidden');
  ipcRenderer.send('set-focusable', true);
  ipcRenderer.send('set-ignore-mouse-events', false);
  renderHistory();
  await Promise.allSettled([renderSchedules(), renderLedgerEntries(), renderSystemStatus(), renderFilesystemSettings()]);
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
  initFileOpenModal({ typeSubtitle, isDashboardOpen, inputContainer });
  initFileRenameModal({ typeSubtitle, isDashboardOpen, inputContainer });
  initFileCreateModal({ typeSubtitle, isDashboardOpen, inputContainer });
  initFileContentEditModal({ typeSubtitle, isDashboardOpen, inputContainer });
  initFileDeleteModal({ typeSubtitle, isDashboardOpen, inputContainer });
  initFileTransferModal({ typeSubtitle, isDashboardOpen, inputContainer });
  initFilesystemSettingsView({ typeSubtitle });

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
    await Promise.allSettled([renderSchedules(), renderLedgerEntries(), renderSystemStatus(), renderFilesystemSettings()]);
  });

  refreshStatusBtn?.addEventListener('click', renderSystemStatus);
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
  renderFilesystemSettings,
  showFileOpenConfirmation,
  showFileOpenCandidates,
  showFileRenameCandidates,
  showFileCreateCandidates,
  showFileContentEditCandidates,
  showFileDeleteCandidates,
  showFileTransferCandidates,
  uiElementsToBlock,
  chatInput,
  inputContainer,
  subtitleBox,
  dashboardOverlay,
};
