const { ipcRenderer } = require('electron');
const {
  fetchNextFileContentEditCandidates,
  previewFileContentEdit,
  confirmFileContentEdit,
} = require('../files/fileContentEditClient');
const { escapeHtml } = require('../shared/html');

let editModal = null;
let editMessage = null;
let editCandidateList = null;
let editSelectedSummary = null;
let editPreviewBtn = null;
let editNextBtn = null;
let editCancelBtn = null;
let editCloseBtn = null;

let confirmModal = null;
let confirmOperation = null;
let confirmTarget = null;
let confirmBefore = null;
let confirmAfter = null;
let confirmWarning = null;
let confirmApplyBtn = null;
let confirmBackBtn = null;
let confirmCancelBtn = null;
let confirmCloseBtn = null;

let inputContainer = null;
let typeSubtitle = () => {};
let isDashboardOpen = () => false;

let currentCandidate = null;
let currentPage = null;
let currentConfirmation = null;
let requestToken = 0;
let previewInFlight = false;
let nextInFlight = false;
let confirmInFlight = false;
let initialized = false;

function initFileContentEditModal(options = {}) {
  if (initialized) return;

  typeSubtitle = options.typeSubtitle || typeSubtitle;
  isDashboardOpen = options.isDashboardOpen || isDashboardOpen;
  inputContainer = options.inputContainer || inputContainer;

  editModal = document.getElementById('file-content-edit-modal');
  editMessage = document.getElementById('file-content-edit-message');
  editCandidateList = document.getElementById('file-content-edit-candidate-list');
  editSelectedSummary = document.getElementById('file-content-edit-selected-summary');
  editPreviewBtn = document.getElementById('file-content-edit-preview-btn');
  editNextBtn = document.getElementById('file-content-edit-next-btn');
  editCancelBtn = document.getElementById('file-content-edit-cancel-btn');
  editCloseBtn = document.getElementById('file-content-edit-close-btn');

  confirmModal = document.getElementById('file-content-edit-confirm-modal');
  confirmOperation = document.getElementById('file-content-edit-confirm-operation');
  confirmTarget = document.getElementById('file-content-edit-confirm-target');
  confirmBefore = document.getElementById('file-content-edit-confirm-before');
  confirmAfter = document.getElementById('file-content-edit-confirm-after');
  confirmWarning = document.getElementById('file-content-edit-confirm-warning');
  confirmApplyBtn = document.getElementById('file-content-edit-apply-btn');
  confirmBackBtn = document.getElementById('file-content-edit-back-btn');
  confirmCancelBtn = document.getElementById('file-content-edit-confirm-cancel-btn');
  confirmCloseBtn = document.getElementById('file-content-edit-confirm-close-btn');

  editCandidateList?.addEventListener('click', handleCandidateClick);
  editPreviewBtn?.addEventListener('click', previewSelectedContentEdit);
  editNextBtn?.addEventListener('click', showNextContentEditCandidates);
  editCancelBtn?.addEventListener('click', () => hideAllContentEditModals('좋아, 수정하지 않을게.'));
  editCloseBtn?.addEventListener('click', () => hideAllContentEditModals('좋아, 수정하지 않을게.'));
  editModal?.addEventListener('click', (event) => {
    if (event.target === editModal) hideAllContentEditModals('좋아, 수정하지 않을게.');
  });

  confirmApplyBtn?.addEventListener('click', confirmPendingContentEdit);
  confirmBackBtn?.addEventListener('click', showCandidateModalAgain);
  confirmCancelBtn?.addEventListener('click', () => hideAllContentEditModals('좋아, 수정하지 않을게.'));
  confirmCloseBtn?.addEventListener('click', () => hideAllContentEditModals('좋아, 수정하지 않을게.'));
  confirmModal?.addEventListener('click', (event) => {
    if (event.target === confirmModal) hideAllContentEditModals('좋아, 수정하지 않을게.');
  });

  initialized = true;
}

function showFileContentEditCandidates(page) {
  if (!editModal || !Array.isArray(page?.candidates) || !page.candidates.length) return;

  resetContentEditState({ incrementToken: true, hide: true });
  currentPage = page;
  const activeToken = requestToken;

  if (editMessage) {
    editMessage.textContent = page.has_more
      ? '내용을 수정할 파일을 선택해 주세요. 원하는 파일이 없으면 다음을 눌러 더 볼 수 있어요.'
      : '내용을 수정할 파일을 선택해 주세요.';
  }

  renderCandidateList(page.candidates);
  updateSelection(null);
  resetButtonsForPage(page);

  window.requestAnimationFrame(() => {
    if (activeToken !== requestToken) return;
    editModal.classList.remove('hidden');
    setMouseInteractive(true);
  });
}

function handleCandidateClick(event) {
  const item = event.target.closest('.file-content-edit-candidate-item');
  if (!item || !currentPage) return;

  const candidate = currentPage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateSelection(candidate);
}

function renderCandidateList(candidates) {
  if (!editCandidateList) return;

  editCandidateList.innerHTML = candidates
    .map((candidate) => {
      const parentPath = candidate.parent_path || getParentPath(candidate.path) || '-';
      const sizeText = formatBytes(candidate.size_bytes);

      return `
        <button class="file-content-edit-candidate-item" type="button" data-candidate-id="${escapeHtml(candidate.id)}">
          <span class="file-content-edit-candidate-name">${escapeHtml(candidate.name || '파일 이름 없음')}</span>
          <span class="file-content-edit-candidate-meta">${escapeHtml(candidate.category || '텍스트/코드 파일')} · ${escapeHtml(sizeText)} · ${escapeHtml(parentPath)}</span>
        </button>
      `;
    })
    .join('');
}

function updateSelection(candidate) {
  currentCandidate = candidate;

  if (editPreviewBtn) {
    editPreviewBtn.disabled = !candidate?.id;
  }

  if (editSelectedSummary) {
    editSelectedSummary.textContent = candidate
      ? '수정할 파일을 선택했어요. 변경 전/후 내용을 확인하려면 다음 단계로 진행해 주세요.'
      : '선택된 파일이 없습니다.';
  }

  if (editCandidateList) {
    for (const element of editCandidateList.querySelectorAll('.file-content-edit-candidate-item')) {
      element.classList.toggle('selected', element.dataset.candidateId === candidate?.id);
    }
  }
}

async function previewSelectedContentEdit() {
  if (!currentCandidate?.id || !editPreviewBtn || previewInFlight) return;

  const activeToken = requestToken;
  const candidate = currentCandidate;

  previewInFlight = true;
  editPreviewBtn.disabled = true;
  editPreviewBtn.textContent = '수정안 생성 중...';

  try {
    const response = await previewFileContentEdit(candidate.id);
    if (activeToken !== requestToken) return;

    if (response.ok && response.confirmation) {
      currentConfirmation = response.confirmation;
      showContentEditConfirmation(response.confirmation);
    } else {
      previewInFlight = false;
      typeSubtitle(response.message || '수정안을 만들 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    previewInFlight = false;
    console.error('🚨 파일 내용 수정 미리보기 실패:', error);
    typeSubtitle('수정안을 만드는 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !editModal?.classList.contains('hidden')) {
      editPreviewBtn.textContent = '변경 내용 확인';
      editPreviewBtn.disabled = previewInFlight || !currentCandidate?.id;
    }
  }
}

function showContentEditConfirmation(confirmation) {
  previewInFlight = false;
  if (!confirmModal || !confirmation) return;

  editModal?.classList.add('hidden');

  if (confirmOperation) confirmOperation.textContent = confirmation.operation || '내용 수정';
  if (confirmTarget) confirmTarget.textContent = confirmation.target_kind || '파일';
  if (confirmBefore) confirmBefore.textContent = confirmation.before_content || '';
  if (confirmAfter) confirmAfter.textContent = confirmation.after_content || '';
  if (confirmWarning) confirmWarning.textContent = confirmation.warning || '적용 후 파일 내용이 변경됩니다.';
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = !confirmation.edit_id;
    confirmApplyBtn.textContent = '적용';
  }

  confirmModal.classList.remove('hidden');
  setMouseInteractive(true);
}

function showCandidateModalAgain() {
  confirmModal?.classList.add('hidden');
  editModal?.classList.remove('hidden');
}

async function confirmPendingContentEdit() {
  if (!currentConfirmation?.edit_id || !confirmApplyBtn || confirmInFlight) return;

  const activeToken = requestToken;
  const editId = currentConfirmation.edit_id;

  confirmInFlight = true;
  confirmApplyBtn.disabled = true;
  confirmApplyBtn.textContent = '적용 중...';

  try {
    const response = await confirmFileContentEdit(editId);
    if (activeToken !== requestToken) return;

    if (response.ok) {
      hideAllContentEditModals(response.message || '파일 내용을 수정했어.');
    } else {
      confirmInFlight = false;
      typeSubtitle(response.message || '파일 내용을 수정하지 못했어.');
      confirmApplyBtn.textContent = '적용';
      confirmApplyBtn.disabled = false;
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    confirmInFlight = false;
    console.error('🚨 파일 내용 수정 적용 실패:', error);
    typeSubtitle('저장하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
    confirmApplyBtn.textContent = '적용';
    confirmApplyBtn.disabled = false;
  }
}

async function showNextContentEditCandidates() {
  if (!currentPage?.request_id || currentPage.next_offset == null || nextInFlight) return;

  const activeToken = requestToken;
  nextInFlight = true;
  editNextBtn.disabled = true;
  editNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextFileContentEditCandidates(currentPage.request_id, currentPage.next_offset);
    if (activeToken !== requestToken) return;

    if (response.ok && response.candidate_page) {
      currentPage = response.candidate_page;
      renderCandidateList(currentPage.candidates || []);
      updateSelection(null);
      resetButtonsForPage(currentPage);
      if (editMessage) {
        editMessage.textContent = currentPage.has_more
          ? '다음 후보를 가져왔어요. 원하는 파일이 없으면 다음을 더 눌러볼 수 있어요.'
          : '마지막 후보 목록이에요. 수정할 파일을 선택해 주세요.';
      }
    } else {
      typeSubtitle(response.message || '더 보여줄 후보가 없어.');
      editNextBtn.classList.add('hidden');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    console.error('🚨 파일 내용 수정 다음 후보 실패:', error);
    typeSubtitle('다음 후보를 불러오는 중 문제가 생겼어.');
  } finally {
    if (activeToken === requestToken) {
      nextInFlight = false;
      resetButtonsForPage(currentPage);
    }
  }
}

function resetButtonsForPage(page) {
  if (editPreviewBtn) {
    editPreviewBtn.textContent = '변경 내용 확인';
    editPreviewBtn.disabled = !currentCandidate?.id || previewInFlight;
  }

  if (editNextBtn) {
    editNextBtn.textContent = '다음';
    editNextBtn.disabled = !page?.has_more || nextInFlight;
    editNextBtn.classList.toggle('hidden', !page?.has_more);
  }
}

function hideAllContentEditModals(message) {
  resetContentEditState({ incrementToken: true, hide: true });
  if (message) typeSubtitle(message);
  restoreMouseInteractivity();
}

function resetContentEditState(options = {}) {
  if (options.incrementToken) requestToken += 1;

  currentCandidate = null;
  currentPage = null;
  currentConfirmation = null;
  previewInFlight = false;
  nextInFlight = false;
  confirmInFlight = false;

  if (editPreviewBtn) {
    editPreviewBtn.textContent = '변경 내용 확인';
    editPreviewBtn.disabled = true;
  }
  if (editNextBtn) {
    editNextBtn.textContent = '다음';
    editNextBtn.disabled = true;
    editNextBtn.classList.add('hidden');
  }
  if (confirmApplyBtn) {
    confirmApplyBtn.textContent = '적용';
    confirmApplyBtn.disabled = true;
  }
  if (editSelectedSummary) editSelectedSummary.textContent = '선택된 파일이 없습니다.';
  if (editCandidateList) editCandidateList.innerHTML = '';

  if (options.hide) {
    editModal?.classList.add('hidden');
    confirmModal?.classList.add('hidden');
  }
}

function setMouseInteractive(value) {
  if (value) {
    ipcRenderer.send('set-focusable', true);
    ipcRenderer.send('set-ignore-mouse-events', false);
    return;
  }

  ipcRenderer.send('set-focusable', false);
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
}

function restoreMouseInteractivity() {
  if (isDashboardOpen()) {
    setMouseInteractive(true);
  } else if (inputContainer?.classList.contains('visible')) {
    setMouseInteractive(true);
  } else {
    setMouseInteractive(false);
  }
}

function getParentPath(path) {
  if (!path) return '';
  const normalized = String(path).replace(/\\+/g, '\\');
  const index = normalized.lastIndexOf('\\');
  return index > -1 ? normalized.slice(0, index) : '';
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

module.exports = {
  initFileContentEditModal,
  showFileContentEditCandidates,
};
