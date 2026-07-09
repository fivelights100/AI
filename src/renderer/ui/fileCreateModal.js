const { ipcRenderer } = require('electron');
const {
  fetchNextFileCreateCandidates,
  previewFileCreate,
  confirmFileCreate,
} = require('../files/fileCreateClient');
const { escapeHtml } = require('../shared/html');

let createModal = null;
let createMessage = null;
let createCandidateList = null;
let createSelectedSummary = null;
let createPreviewBtn = null;
let createNextBtn = null;
let createCancelBtn = null;
let createCloseBtn = null;

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

function initFileCreateModal(options = {}) {
  if (initialized) return;

  typeSubtitle = options.typeSubtitle || typeSubtitle;
  isDashboardOpen = options.isDashboardOpen || isDashboardOpen;
  inputContainer = options.inputContainer || inputContainer;

  createModal = document.getElementById('file-create-modal');
  createMessage = document.getElementById('file-create-message');
  createCandidateList = document.getElementById('file-create-candidate-list');
  createSelectedSummary = document.getElementById('file-create-selected-summary');
  createPreviewBtn = document.getElementById('file-create-preview-btn');
  createNextBtn = document.getElementById('file-create-next-btn');
  createCancelBtn = document.getElementById('file-create-cancel-btn');
  createCloseBtn = document.getElementById('file-create-close-btn');

  confirmModal = document.getElementById('file-create-confirm-modal');
  confirmOperation = document.getElementById('file-create-confirm-operation');
  confirmTarget = document.getElementById('file-create-confirm-target');
  confirmBefore = document.getElementById('file-create-confirm-before');
  confirmAfter = document.getElementById('file-create-confirm-after');
  confirmWarning = document.getElementById('file-create-confirm-warning');
  confirmApplyBtn = document.getElementById('file-create-apply-btn');
  confirmBackBtn = document.getElementById('file-create-back-btn');
  confirmCancelBtn = document.getElementById('file-create-confirm-cancel-btn');
  confirmCloseBtn = document.getElementById('file-create-confirm-close-btn');

  createCandidateList?.addEventListener('click', handleCandidateClick);
  createPreviewBtn?.addEventListener('click', previewSelectedCreate);
  createNextBtn?.addEventListener('click', showNextCreateCandidates);
  createCancelBtn?.addEventListener('click', () => hideAllCreateModals('좋아, 생성하지 않을게.'));
  createCloseBtn?.addEventListener('click', () => hideAllCreateModals('좋아, 생성하지 않을게.'));
  createModal?.addEventListener('click', (event) => {
    if (event.target === createModal) hideAllCreateModals('좋아, 생성하지 않을게.');
  });

  confirmApplyBtn?.addEventListener('click', confirmPendingCreate);
  confirmBackBtn?.addEventListener('click', showCandidateModalAgain);
  confirmCancelBtn?.addEventListener('click', () => hideAllCreateModals('좋아, 생성하지 않을게.'));
  confirmCloseBtn?.addEventListener('click', () => hideAllCreateModals('좋아, 생성하지 않을게.'));
  confirmModal?.addEventListener('click', (event) => {
    if (event.target === confirmModal) hideAllCreateModals('좋아, 생성하지 않을게.');
  });

  initialized = true;
}

function showFileCreateCandidates(page) {
  if (!createModal || !Array.isArray(page?.candidates) || !page.candidates.length) return;

  resetCreateState({ incrementToken: true, hide: true });
  currentPage = page;
  const activeToken = requestToken;

  if (createMessage) {
    createMessage.textContent = page.has_more
      ? '생성 위치를 선택해 주세요. 원하는 위치가 없으면 다음을 눌러 더 볼 수 있어요.'
      : '생성 위치를 선택해 주세요.';
  }

  renderCandidateList(page.candidates);
  updateSelection(null);
  resetButtonsForPage(page);

  window.requestAnimationFrame(() => {
    if (activeToken !== requestToken) return;
    createModal.classList.remove('hidden');
    setMouseInteractive(true);
  });
}

function handleCandidateClick(event) {
  const item = event.target.closest('.file-create-candidate-item');
  if (!item || !currentPage) return;

  const candidate = currentPage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateSelection(candidate);
}

function renderCandidateList(candidates) {
  if (!createCandidateList) return;

  createCandidateList.innerHTML = candidates
    .map((candidate) => {
      const parentPath = candidate.parent_path || getParentPath(candidate.path) || '-';

      return `
        <button class="file-create-candidate-item" type="button" data-candidate-id="${escapeHtml(candidate.id)}">
          <span class="file-create-candidate-name">${escapeHtml(candidate.name || '위치 이름 없음')}</span>
          <span class="file-create-candidate-meta">${escapeHtml(candidate.category || '생성 위치')} · ${escapeHtml(parentPath)}</span>
        </button>
      `;
    })
    .join('');
}

function updateSelection(candidate) {
  currentCandidate = candidate;

  if (createPreviewBtn) {
    createPreviewBtn.disabled = !candidate?.id;
  }

  if (createSelectedSummary) {
    createSelectedSummary.textContent = candidate
      ? '생성 위치를 선택했어요. 생성 내용을 확인하려면 다음 단계로 진행해 주세요.'
      : '선택된 위치가 없습니다.';
  }

  if (createCandidateList) {
    for (const element of createCandidateList.querySelectorAll('.file-create-candidate-item')) {
      element.classList.toggle('selected', element.dataset.candidateId === candidate?.id);
    }
  }
}

async function previewSelectedCreate() {
  if (!currentCandidate?.id || !createPreviewBtn || previewInFlight) return;

  const activeToken = requestToken;
  const candidate = currentCandidate;

  previewInFlight = true;
  createPreviewBtn.disabled = true;
  createPreviewBtn.textContent = '확인 중...';

  try {
    const response = await previewFileCreate(candidate.id);
    if (activeToken !== requestToken) return;

    if (response.ok && response.confirmation) {
      currentConfirmation = response.confirmation;
      showCreateConfirmation(response.confirmation);
    } else {
      previewInFlight = false;
      typeSubtitle(response.message || '생성 내용을 만들 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    previewInFlight = false;
    console.error('🚨 파일/폴더 생성 미리보기 실패:', error);
    typeSubtitle('생성 내용을 확인하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !createModal?.classList.contains('hidden')) {
      createPreviewBtn.textContent = '생성 내용 확인';
      createPreviewBtn.disabled = previewInFlight || !currentCandidate?.id;
    }
  }
}

function showCreateConfirmation(confirmation) {
  previewInFlight = false;
  if (!confirmModal || !confirmation) return;

  createModal?.classList.add('hidden');

  if (confirmOperation) confirmOperation.textContent = confirmation.operation || '생성';
  if (confirmTarget) confirmTarget.textContent = confirmation.target_kind || (confirmation.is_folder ? '폴더' : '파일');
  if (confirmBefore) confirmBefore.textContent = confirmation.before || '없음';
  if (confirmAfter) {
    const afterText = confirmation.is_folder
      ? `${confirmation.target_path || '-'}\n\n${confirmation.after || ''}`.trim()
      : `${confirmation.target_path || '-'}\n\n${confirmation.after || ''}`.trim();
    confirmAfter.textContent = afterText || '-';
  }
  if (confirmWarning) confirmWarning.textContent = confirmation.warning || '적용 후 새 항목이 생성됩니다.';
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = !confirmation.edit_id;
    confirmApplyBtn.textContent = '적용';
  }

  confirmModal.classList.remove('hidden');
  setMouseInteractive(true);
}

function showCandidateModalAgain() {
  confirmModal?.classList.add('hidden');
  createModal?.classList.remove('hidden');
}

async function confirmPendingCreate() {
  if (!currentConfirmation?.edit_id || !confirmApplyBtn || confirmInFlight) return;

  const activeToken = requestToken;
  const editId = currentConfirmation.edit_id;

  confirmInFlight = true;
  confirmApplyBtn.disabled = true;
  confirmApplyBtn.textContent = '적용 중...';

  try {
    const response = await confirmFileCreate(editId);
    if (activeToken !== requestToken) return;

    if (response.ok) {
      hideAllCreateModals(response.message || '생성을 완료했어.');
    } else {
      confirmInFlight = false;
      typeSubtitle(response.message || '생성하지 못했어.');
      confirmApplyBtn.textContent = '적용';
      confirmApplyBtn.disabled = false;
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    confirmInFlight = false;
    console.error('🚨 파일/폴더 생성 적용 실패:', error);
    typeSubtitle('생성하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
    confirmApplyBtn.textContent = '적용';
    confirmApplyBtn.disabled = false;
  }
}

async function showNextCreateCandidates() {
  if (!currentPage?.request_id || currentPage.next_offset == null || nextInFlight) return;

  const activeToken = requestToken;
  nextInFlight = true;
  createNextBtn.disabled = true;
  createNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextFileCreateCandidates(currentPage.request_id, currentPage.next_offset);
    if (activeToken !== requestToken) return;

    if (response.ok && response.candidate_page) {
      currentPage = response.candidate_page;
      renderCandidateList(currentPage.candidates || []);
      updateSelection(null);
      resetButtonsForPage(currentPage);
      if (createMessage) {
        createMessage.textContent = currentPage.has_more
          ? '다음 후보를 가져왔어요. 원하는 위치가 없으면 다음을 더 눌러볼 수 있어요.'
          : '마지막 후보 목록이에요. 생성 위치를 선택해 주세요.';
      }
    } else {
      typeSubtitle(response.message || '더 보여줄 후보가 없어.');
      createNextBtn.classList.add('hidden');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    console.error('🚨 파일/폴더 생성 다음 후보 실패:', error);
    typeSubtitle('다음 후보를 불러오는 중 문제가 생겼어.');
  } finally {
    if (activeToken === requestToken) {
      nextInFlight = false;
      if (createNextBtn && currentPage?.has_more) {
        createNextBtn.disabled = false;
        createNextBtn.textContent = '다음';
      }
    }
  }
}

function resetButtonsForPage(page) {
  previewInFlight = false;
  nextInFlight = false;
  confirmInFlight = false;

  if (createPreviewBtn) {
    createPreviewBtn.disabled = true;
    createPreviewBtn.textContent = '생성 내용 확인';
  }

  if (createNextBtn) {
    createNextBtn.textContent = '다음';
    createNextBtn.disabled = false;
    createNextBtn.classList.toggle('hidden', !page?.has_more);
  }
}

function hideAllCreateModals(message) {
  resetCreateState({ incrementToken: true, hide: true });
  if (message) typeSubtitle(message);
  if (!isDashboardOpen()) {
    setMouseInteractive(false);
  }
}

function resetCreateState({ incrementToken = false, hide = false } = {}) {
  if (incrementToken) requestToken += 1;

  currentCandidate = null;
  currentPage = null;
  currentConfirmation = null;
  previewInFlight = false;
  nextInFlight = false;
  confirmInFlight = false;

  if (hide) {
    createModal?.classList.add('hidden');
    confirmModal?.classList.add('hidden');
  }

  if (createCandidateList) createCandidateList.innerHTML = '';
  if (createSelectedSummary) createSelectedSummary.textContent = '선택된 위치가 없습니다.';
  if (createPreviewBtn) {
    createPreviewBtn.disabled = true;
    createPreviewBtn.textContent = '생성 내용 확인';
  }
  if (createNextBtn) {
    createNextBtn.disabled = false;
    createNextBtn.textContent = '다음';
    createNextBtn.classList.add('hidden');
  }
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = true;
    confirmApplyBtn.textContent = '적용';
  }
}

function setMouseInteractive(enabled) {
  if (enabled) {
    ipcRenderer.send('set-focusable', true);
    ipcRenderer.send('set-ignore-mouse-events', false);
    return;
  }

  ipcRenderer.send('set-focusable', false);
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  if (inputContainer) inputContainer.style.display = 'none';
}

function getParentPath(path) {
  if (!path || typeof path !== 'string') return '';
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? path.slice(0, index) : '';
}

module.exports = {
  initFileCreateModal,
  showFileCreateCandidates,
};
