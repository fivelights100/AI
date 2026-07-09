const {
  fetchNextFileRenameCandidates,
  previewFileRename,
  confirmFileRename,
} = require('../files/fileRenameClient');
const { setMouseInteractive, getParentPath, formatExtensionLabel, renderCandidateButtons, markSelectedCandidate } = require('./fileOperationUi');

let renameModal = null;
let renameMessage = null;
let renameCandidateList = null;
let renameSelectedSummary = null;
let renamePreviewBtn = null;
let renameNextBtn = null;
let renameCancelBtn = null;
let renameCloseBtn = null;

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

function initFileRenameModal(options = {}) {
  if (initialized) return;

  typeSubtitle = options.typeSubtitle || typeSubtitle;
  isDashboardOpen = options.isDashboardOpen || isDashboardOpen;
  inputContainer = options.inputContainer || inputContainer;

  renameModal = document.getElementById('file-rename-modal');
  renameMessage = document.getElementById('file-rename-message');
  renameCandidateList = document.getElementById('file-rename-candidate-list');
  renameSelectedSummary = document.getElementById('file-rename-selected-summary');
  renamePreviewBtn = document.getElementById('file-rename-preview-btn');
  renameNextBtn = document.getElementById('file-rename-next-btn');
  renameCancelBtn = document.getElementById('file-rename-cancel-btn');
  renameCloseBtn = document.getElementById('file-rename-close-btn');

  confirmModal = document.getElementById('file-rename-confirm-modal');
  confirmOperation = document.getElementById('file-rename-confirm-operation');
  confirmTarget = document.getElementById('file-rename-confirm-target');
  confirmBefore = document.getElementById('file-rename-confirm-before');
  confirmAfter = document.getElementById('file-rename-confirm-after');
  confirmWarning = document.getElementById('file-rename-confirm-warning');
  confirmApplyBtn = document.getElementById('file-rename-apply-btn');
  confirmBackBtn = document.getElementById('file-rename-back-btn');
  confirmCancelBtn = document.getElementById('file-rename-confirm-cancel-btn');
  confirmCloseBtn = document.getElementById('file-rename-confirm-close-btn');

  renameCandidateList?.addEventListener('click', handleCandidateClick);
  renamePreviewBtn?.addEventListener('click', previewSelectedRename);
  renameNextBtn?.addEventListener('click', showNextRenameCandidates);
  renameCancelBtn?.addEventListener('click', () => hideAllRenameModals('좋아, 변경하지 않을게.'));
  renameCloseBtn?.addEventListener('click', () => hideAllRenameModals('좋아, 변경하지 않을게.'));
  renameModal?.addEventListener('click', (event) => {
    if (event.target === renameModal) hideAllRenameModals('좋아, 변경하지 않을게.');
  });

  confirmApplyBtn?.addEventListener('click', confirmPendingRename);
  confirmBackBtn?.addEventListener('click', showCandidateModalAgain);
  confirmCancelBtn?.addEventListener('click', () => hideAllRenameModals('좋아, 변경하지 않을게.'));
  confirmCloseBtn?.addEventListener('click', () => hideAllRenameModals('좋아, 변경하지 않을게.'));
  confirmModal?.addEventListener('click', (event) => {
    if (event.target === confirmModal) hideAllRenameModals('좋아, 변경하지 않을게.');
  });

  initialized = true;
}

function showFileRenameCandidates(page) {
  if (!renameModal || !Array.isArray(page?.candidates) || !page.candidates.length) return;

  resetRenameState({ incrementToken: true, hide: true });
  currentPage = page;
  const activeToken = requestToken;

  if (renameMessage) {
    renameMessage.textContent = page.has_more
      ? '이름을 변경할 대상을 선택해 주세요. 원하는 항목이 없으면 다음을 눌러 더 볼 수 있어요.'
      : '이름을 변경할 대상을 선택해 주세요.';
  }

  renderCandidateList(page.candidates);
  updateSelection(null);
  resetButtonsForPage(page);

  window.requestAnimationFrame(() => {
    if (activeToken !== requestToken) return;
    renameModal.classList.remove('hidden');
    setMouseInteractive(true);
  });
}

function handleCandidateClick(event) {
  const item = event.target.closest('.file-rename-candidate-item');
  if (!item || !currentPage) return;

  const candidate = currentPage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateSelection(candidate);
}

function renderCandidateList(candidates) {
  if (!renameCandidateList) return;

  renameCandidateList.innerHTML = renderCandidateButtons(candidates, {
    itemClass: 'file-rename-candidate-item',
    nameClass: 'file-rename-candidate-name',
    metaClass: 'file-rename-candidate-meta',
    emptyName: '이름 없음',
  });
}

function updateSelection(candidate) {
  currentCandidate = candidate;

  if (renamePreviewBtn) {
    renamePreviewBtn.disabled = !candidate?.id;
  }

  if (renameSelectedSummary) {
    if (!candidate) {
      renameSelectedSummary.textContent = '선택된 항목이 없습니다.';
    } else {
      const typeLabel = candidate.is_folder
        ? '폴더'
        : candidate.category || formatExtensionLabel(candidate.extension);
      renameSelectedSummary.textContent = `${typeLabel}을 선택했어요. 변경 내용을 확인하려면 다음 단계로 진행해 주세요.`;
    }
  }

  markSelectedCandidate(renameCandidateList, '.file-rename-candidate-item', candidate?.id);
}

async function previewSelectedRename() {
  if (!currentCandidate?.id || !renamePreviewBtn || previewInFlight) return;

  const activeToken = requestToken;
  const candidate = currentCandidate;

  previewInFlight = true;
  renamePreviewBtn.disabled = true;
  renamePreviewBtn.textContent = '확인 중...';

  try {
    const response = await previewFileRename(candidate.id);
    if (activeToken !== requestToken) return;

    if (response.ok && response.confirmation) {
      currentConfirmation = response.confirmation;
      showRenameConfirmation(response.confirmation);
    } else {
      previewInFlight = false;
      typeSubtitle(response.message || '변경 내용을 만들 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    previewInFlight = false;
    console.error('🚨 파일/폴더 이름 변경 미리보기 실패:', error);
    typeSubtitle('이름 변경 내용을 확인하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !renameModal?.classList.contains('hidden')) {
      renamePreviewBtn.textContent = '변경 내용 확인';
      renamePreviewBtn.disabled = previewInFlight || !currentCandidate?.id;
    }
  }
}

function showRenameConfirmation(confirmation) {
  previewInFlight = false;
  if (!confirmModal || !confirmation) return;

  renameModal?.classList.add('hidden');

  if (confirmOperation) confirmOperation.textContent = confirmation.operation || '이름 변경';
  if (confirmTarget) confirmTarget.textContent = confirmation.target_kind || (confirmation.is_folder ? '폴더' : '파일');
  if (confirmBefore) confirmBefore.textContent = confirmation.before_path || confirmation.before_name || '-';
  if (confirmAfter) confirmAfter.textContent = confirmation.after_path || confirmation.after_name || '-';
  if (confirmWarning) confirmWarning.textContent = confirmation.warning || '적용 후에는 이름이 변경됩니다.';
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = !confirmation.edit_id;
    confirmApplyBtn.textContent = '적용';
  }

  confirmModal.classList.remove('hidden');
  setMouseInteractive(true);
}

function showCandidateModalAgain() {
  confirmModal?.classList.add('hidden');
  renameModal?.classList.remove('hidden');
}

async function confirmPendingRename() {
  if (!currentConfirmation?.edit_id || !confirmApplyBtn || confirmInFlight) return;

  const activeToken = requestToken;
  const editId = currentConfirmation.edit_id;

  confirmInFlight = true;
  confirmApplyBtn.disabled = true;
  confirmApplyBtn.textContent = '적용 중...';

  try {
    const response = await confirmFileRename(editId);
    if (activeToken !== requestToken) return;

    if (response.ok) {
      hideAllRenameModals(response.message || '이름을 변경했어.');
    } else {
      confirmInFlight = false;
      typeSubtitle(response.message || '이름을 변경할 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    confirmInFlight = false;
    console.error('🚨 파일/폴더 이름 변경 적용 실패:', error);
    typeSubtitle('이름 변경 요청 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !confirmModal?.classList.contains('hidden')) {
      confirmApplyBtn.textContent = '적용';
      confirmApplyBtn.disabled = confirmInFlight || !currentConfirmation?.edit_id;
    }
  }
}

async function showNextRenameCandidates() {
  if (!currentPage?.request_id || currentPage.next_offset == null) return;
  if (!renameNextBtn || nextInFlight) return;

  const activeToken = requestToken;
  const requestId = currentPage.request_id;
  const nextOffset = currentPage.next_offset;

  nextInFlight = true;
  renameNextBtn.disabled = true;
  renameNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextFileRenameCandidates(requestId, nextOffset);
    if (activeToken !== requestToken) return;

    if (response.ok && response.candidate_page) {
      showFileRenameCandidates(response.candidate_page);
    } else {
      nextInFlight = false;
      typeSubtitle(response.message || '더 보여줄 후보가 없어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    nextInFlight = false;
    console.error('🚨 파일/폴더 이름 변경 후보 다음 페이지 조회 실패:', error);
    typeSubtitle('다음 후보를 불러오지 못했어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !renameModal?.classList.contains('hidden')) {
      renameNextBtn.textContent = '다음';
      renameNextBtn.disabled = nextInFlight || !currentPage?.has_more;
    }
  }
}

function hideAllRenameModals(message) {
  resetRenameState({ incrementToken: true, hide: true, clearDom: true });

  if (message) typeSubtitle(message);

  if (!isDashboardOpen() && inputContainer?.style.display !== 'block') {
    setMouseInteractive(false);
  }
}

function resetButtonsForPage(page) {
  if (renamePreviewBtn) {
    renamePreviewBtn.textContent = '변경 내용 확인';
    renamePreviewBtn.disabled = true;
  }

  if (renameNextBtn) {
    renameNextBtn.textContent = '다음';
    renameNextBtn.classList.toggle('hidden', !page.has_more);
    renameNextBtn.disabled = !page.has_more;
  }
}

function resetRenameState({ incrementToken = false, hide = false, clearDom = false } = {}) {
  if (incrementToken) requestToken += 1;

  previewInFlight = false;
  nextInFlight = false;
  confirmInFlight = false;
  currentCandidate = null;
  currentPage = null;
  currentConfirmation = null;

  if (hide) {
    renameModal?.classList.add('hidden');
    confirmModal?.classList.add('hidden');
  }

  if (clearDom && renameCandidateList) renameCandidateList.innerHTML = '';
  if (renameSelectedSummary) renameSelectedSummary.textContent = '선택된 항목이 없습니다.';
  if (renamePreviewBtn) {
    renamePreviewBtn.disabled = true;
    renamePreviewBtn.textContent = '변경 내용 확인';
  }
  if (renameNextBtn) {
    renameNextBtn.classList.add('hidden');
    renameNextBtn.disabled = true;
    renameNextBtn.textContent = '다음';
  }
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = true;
    confirmApplyBtn.textContent = '적용';
  }
}


module.exports = {
  initFileRenameModal,
  showFileRenameCandidates,
};
