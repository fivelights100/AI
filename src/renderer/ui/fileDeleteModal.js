const { ipcRenderer } = require('electron');
const {
  fetchNextFileDeleteCandidates,
  previewFileDelete,
  confirmFileDelete,
} = require('../files/fileDeleteClient');
const { escapeHtml } = require('../shared/html');

let deleteModal = null;
let deleteMessage = null;
let deleteCandidateList = null;
let deleteSelectedSummary = null;
let deletePreviewBtn = null;
let deleteNextBtn = null;
let deleteCancelBtn = null;
let deleteCloseBtn = null;

let confirmModal = null;
let confirmOperation = null;
let confirmMethod = null;
let confirmTarget = null;
let confirmPath = null;
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

function initFileDeleteModal(options = {}) {
  if (initialized) return;

  typeSubtitle = options.typeSubtitle || typeSubtitle;
  isDashboardOpen = options.isDashboardOpen || isDashboardOpen;
  inputContainer = options.inputContainer || inputContainer;

  deleteModal = document.getElementById('file-delete-modal');
  deleteMessage = document.getElementById('file-delete-message');
  deleteCandidateList = document.getElementById('file-delete-candidate-list');
  deleteSelectedSummary = document.getElementById('file-delete-selected-summary');
  deletePreviewBtn = document.getElementById('file-delete-preview-btn');
  deleteNextBtn = document.getElementById('file-delete-next-btn');
  deleteCancelBtn = document.getElementById('file-delete-cancel-btn');
  deleteCloseBtn = document.getElementById('file-delete-close-btn');

  confirmModal = document.getElementById('file-delete-confirm-modal');
  confirmOperation = document.getElementById('file-delete-confirm-operation');
  confirmMethod = document.getElementById('file-delete-confirm-method');
  confirmTarget = document.getElementById('file-delete-confirm-target');
  confirmPath = document.getElementById('file-delete-confirm-path');
  confirmWarning = document.getElementById('file-delete-confirm-warning');
  confirmApplyBtn = document.getElementById('file-delete-apply-btn');
  confirmBackBtn = document.getElementById('file-delete-back-btn');
  confirmCancelBtn = document.getElementById('file-delete-confirm-cancel-btn');
  confirmCloseBtn = document.getElementById('file-delete-confirm-close-btn');

  deleteCandidateList?.addEventListener('click', handleCandidateClick);
  deletePreviewBtn?.addEventListener('click', previewSelectedDelete);
  deleteNextBtn?.addEventListener('click', showNextDeleteCandidates);
  deleteCancelBtn?.addEventListener('click', () => hideAllDeleteModals('좋아, 삭제하지 않을게.'));
  deleteCloseBtn?.addEventListener('click', () => hideAllDeleteModals('좋아, 삭제하지 않을게.'));
  deleteModal?.addEventListener('click', (event) => {
    if (event.target === deleteModal) hideAllDeleteModals('좋아, 삭제하지 않을게.');
  });

  confirmApplyBtn?.addEventListener('click', confirmPendingDelete);
  confirmBackBtn?.addEventListener('click', showCandidateModalAgain);
  confirmCancelBtn?.addEventListener('click', () => hideAllDeleteModals('좋아, 삭제하지 않을게.'));
  confirmCloseBtn?.addEventListener('click', () => hideAllDeleteModals('좋아, 삭제하지 않을게.'));
  confirmModal?.addEventListener('click', (event) => {
    if (event.target === confirmModal) hideAllDeleteModals('좋아, 삭제하지 않을게.');
  });

  initialized = true;
}

function showFileDeleteCandidates(page) {
  if (!deleteModal || !Array.isArray(page?.candidates) || !page.candidates.length) return;

  resetDeleteState({ incrementToken: true, hide: true });
  currentPage = page;
  const activeToken = requestToken;

  if (deleteMessage) {
    deleteMessage.textContent = page.has_more
      ? '삭제할 항목을 선택해 주세요. 원하는 항목이 없으면 다음을 눌러 더 볼 수 있어요.'
      : '삭제할 항목을 선택해 주세요.';
  }

  renderCandidateList(page.candidates);
  updateSelection(null);
  resetButtonsForPage(page);

  window.requestAnimationFrame(() => {
    if (activeToken !== requestToken) return;
    deleteModal.classList.remove('hidden');
    setMouseInteractive(true);
  });
}

function handleCandidateClick(event) {
  const item = event.target.closest('.file-delete-candidate-item');
  if (!item || !currentPage) return;

  const candidate = currentPage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateSelection(candidate);
}

function renderCandidateList(candidates) {
  if (!deleteCandidateList) return;

  deleteCandidateList.innerHTML = candidates
    .map((candidate) => {
      const parentPath = candidate.parent_path || getParentPath(candidate.path) || '-';

      return `
        <button class="file-delete-candidate-item" type="button" data-candidate-id="${escapeHtml(candidate.id)}">
          <span class="file-delete-candidate-name">${escapeHtml(candidate.name || '항목 이름 없음')}</span>
          <span class="file-delete-candidate-meta">${escapeHtml(candidate.category || (candidate.is_folder ? '폴더' : '파일'))} · ${escapeHtml(parentPath)}</span>
        </button>
      `;
    })
    .join('');
}

function updateSelection(candidate) {
  currentCandidate = candidate;

  if (deletePreviewBtn) {
    deletePreviewBtn.disabled = !candidate?.id;
  }

  if (deleteSelectedSummary) {
    deleteSelectedSummary.textContent = candidate
      ? '삭제할 항목을 선택했어요. 삭제 내용을 확인하려면 다음 단계로 진행해 주세요.'
      : '선택된 항목이 없습니다.';
  }

  if (deleteCandidateList) {
    for (const element of deleteCandidateList.querySelectorAll('.file-delete-candidate-item')) {
      element.classList.toggle('selected', element.dataset.candidateId === candidate?.id);
    }
  }
}

async function previewSelectedDelete() {
  if (!currentCandidate?.id || !deletePreviewBtn || previewInFlight) return;

  const activeToken = requestToken;
  const candidate = currentCandidate;

  previewInFlight = true;
  deletePreviewBtn.disabled = true;
  deletePreviewBtn.textContent = '확인 중...';

  try {
    const response = await previewFileDelete(candidate.id);
    if (activeToken !== requestToken) return;

    if (response.ok && response.confirmation) {
      currentConfirmation = response.confirmation;
      showDeleteConfirmation(response.confirmation);
    } else {
      previewInFlight = false;
      typeSubtitle(response.message || '삭제 내용을 확인할 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    previewInFlight = false;
    console.error('🚨 파일/폴더 삭제 미리보기 실패:', error);
    typeSubtitle('삭제 내용을 확인하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !deleteModal?.classList.contains('hidden')) {
      deletePreviewBtn.textContent = '삭제 내용 확인';
      deletePreviewBtn.disabled = previewInFlight || !currentCandidate?.id;
    }
  }
}

function showDeleteConfirmation(confirmation) {
  previewInFlight = false;
  if (!confirmModal || !confirmation) return;

  deleteModal?.classList.add('hidden');

  if (confirmOperation) confirmOperation.textContent = confirmation.operation || '삭제';
  if (confirmMethod) confirmMethod.textContent = confirmation.delete_method || '휴지통으로 이동';
  if (confirmTarget) confirmTarget.textContent = confirmation.target_kind || (confirmation.is_folder ? '폴더' : '파일');
  if (confirmPath) {
    confirmPath.textContent = `${confirmation.target_path || '-'}\n\n상위 위치: ${confirmation.parent_path || '-'}`;
  }
  if (confirmWarning) confirmWarning.textContent = confirmation.warning || '선택한 항목이 휴지통으로 이동됩니다.';
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = !confirmation.delete_id;
    confirmApplyBtn.textContent = '휴지통으로 이동';
  }

  confirmModal.classList.remove('hidden');
  setMouseInteractive(true);
}

function showCandidateModalAgain() {
  confirmModal?.classList.add('hidden');
  deleteModal?.classList.remove('hidden');
}

async function confirmPendingDelete() {
  if (!currentConfirmation?.delete_id || !confirmApplyBtn || confirmInFlight) return;

  const activeToken = requestToken;
  const deleteId = currentConfirmation.delete_id;

  confirmInFlight = true;
  confirmApplyBtn.disabled = true;
  confirmApplyBtn.textContent = '이동 중...';

  try {
    const response = await confirmFileDelete(deleteId);
    if (activeToken !== requestToken) return;

    if (response.ok) {
      hideAllDeleteModals(response.message || '선택한 항목을 휴지통으로 이동했어.');
    } else {
      confirmInFlight = false;
      typeSubtitle(response.message || '삭제하지 못했어.');
      confirmApplyBtn.textContent = '휴지통으로 이동';
      confirmApplyBtn.disabled = false;
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    confirmInFlight = false;
    console.error('🚨 파일/폴더 삭제 적용 실패:', error);
    typeSubtitle('휴지통으로 이동하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
    confirmApplyBtn.textContent = '휴지통으로 이동';
    confirmApplyBtn.disabled = false;
  }
}

async function showNextDeleteCandidates() {
  if (!currentPage?.request_id || currentPage.next_offset == null || nextInFlight) return;

  const activeToken = requestToken;
  nextInFlight = true;
  deleteNextBtn.disabled = true;
  deleteNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextFileDeleteCandidates(currentPage.request_id, currentPage.next_offset);
    if (activeToken !== requestToken) return;

    if (response.ok && response.candidate_page) {
      currentPage = response.candidate_page;
      renderCandidateList(currentPage.candidates || []);
      updateSelection(null);
      resetButtonsForPage(currentPage);
      if (deleteMessage) {
        deleteMessage.textContent = currentPage.has_more
          ? '다음 후보를 가져왔어요. 원하는 항목이 없으면 다음을 더 눌러볼 수 있어요.'
          : '마지막 후보 목록이에요. 삭제할 항목을 선택해 주세요.';
      }
    } else {
      typeSubtitle(response.message || '더 보여줄 후보가 없어.');
      deleteNextBtn.classList.add('hidden');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    console.error('🚨 파일/폴더 삭제 다음 후보 실패:', error);
    typeSubtitle('다음 후보를 불러오는 중 문제가 생겼어.');
  } finally {
    if (activeToken === requestToken) {
      nextInFlight = false;
      resetButtonsForPage(currentPage);
    }
  }
}

function resetButtonsForPage(page) {
  if (deletePreviewBtn) {
    deletePreviewBtn.textContent = '삭제 내용 확인';
    deletePreviewBtn.disabled = !currentCandidate?.id || previewInFlight;
  }

  if (deleteNextBtn) {
    deleteNextBtn.textContent = '다음';
    deleteNextBtn.disabled = !page?.has_more || nextInFlight;
    deleteNextBtn.classList.toggle('hidden', !page?.has_more);
  }
}

function hideAllDeleteModals(message) {
  resetDeleteState({ incrementToken: true, hide: true });
  if (message) typeSubtitle(message);
  restoreMouseInteractivity();
}

function resetDeleteState(options = {}) {
  if (options.incrementToken) requestToken += 1;

  currentCandidate = null;
  currentPage = null;
  currentConfirmation = null;
  previewInFlight = false;
  nextInFlight = false;
  confirmInFlight = false;

  if (deletePreviewBtn) {
    deletePreviewBtn.textContent = '삭제 내용 확인';
    deletePreviewBtn.disabled = true;
  }
  if (deleteNextBtn) {
    deleteNextBtn.textContent = '다음';
    deleteNextBtn.disabled = true;
    deleteNextBtn.classList.add('hidden');
  }
  if (confirmApplyBtn) {
    confirmApplyBtn.textContent = '휴지통으로 이동';
    confirmApplyBtn.disabled = true;
  }
  if (deleteSelectedSummary) deleteSelectedSummary.textContent = '선택된 항목이 없습니다.';
  if (deleteCandidateList) deleteCandidateList.innerHTML = '';

  if (options.hide) {
    deleteModal?.classList.add('hidden');
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

module.exports = {
  initFileDeleteModal,
  showFileDeleteCandidates,
};
