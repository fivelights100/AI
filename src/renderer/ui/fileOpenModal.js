const { ipcRenderer } = require('electron');
const { fetchNextFileOpenCandidates, confirmFileOpen } = require('../files/fileOpenClient');
const { escapeHtml } = require('../shared/html');

let fileOpenModal = null;
let fileOpenMessage = null;
let fileOpenCandidateList = null;
let fileOpenSelectedSummary = null;
let fileOpenConfirmBtn = null;
let fileOpenNextBtn = null;
let fileOpenCancelBtn = null;
let fileOpenCloseBtn = null;
let inputContainer = null;

let typeSubtitle = () => {};
let isDashboardOpen = () => false;

let currentCandidate = null;
let currentPage = null;
let requestToken = 0;
let confirmInFlight = false;
let nextInFlight = false;
let initialized = false;

function initFileOpenModal(options = {}) {
  if (initialized) return;

  typeSubtitle = options.typeSubtitle || typeSubtitle;
  isDashboardOpen = options.isDashboardOpen || isDashboardOpen;
  inputContainer = options.inputContainer || inputContainer;

  fileOpenModal = document.getElementById('file-open-modal');
  fileOpenMessage = document.getElementById('file-open-message');
  fileOpenCandidateList = document.getElementById('file-open-candidate-list');
  fileOpenSelectedSummary = document.getElementById('file-open-selected-summary');
  fileOpenConfirmBtn = document.getElementById('file-open-confirm-btn');
  fileOpenNextBtn = document.getElementById('file-open-next-btn');
  fileOpenCancelBtn = document.getElementById('file-open-cancel-btn');
  fileOpenCloseBtn = document.getElementById('file-open-close-btn');

  fileOpenConfirmBtn?.addEventListener('click', confirmPendingFileOpen);
  fileOpenNextBtn?.addEventListener('click', showNextFileOpenCandidates);
  fileOpenCandidateList?.addEventListener('click', handleCandidateClick);
  fileOpenCancelBtn?.addEventListener('click', () => hideFileOpenConfirmation('좋아, 열지 않을게.'));
  fileOpenCloseBtn?.addEventListener('click', () => hideFileOpenConfirmation('좋아, 열지 않을게.'));
  fileOpenModal?.addEventListener('click', (event) => {
    if (event.target === fileOpenModal) {
      hideFileOpenConfirmation('좋아, 열지 않을게.');
    }
  });

  initialized = true;
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

  resetModalState({ incrementToken: true, hide: true });
  currentPage = page;
  const activeToken = requestToken;

  if (fileOpenMessage) {
    fileOpenMessage.textContent = page.has_more
      ? '열 대상을 선택해 주세요. 원하는 항목이 없으면 다음을 눌러 더 볼 수 있어요.'
      : '열 대상을 선택해 주세요.';
  }

  renderCandidateList(page.candidates);
  updateSelection(null);
  resetButtonsForPage(page);

  window.requestAnimationFrame(() => {
    if (activeToken !== requestToken) return;
    fileOpenModal.classList.remove('hidden');
    setMouseInteractive(true);
  });
}

function hideFileOpenConfirmation(message) {
  resetModalState({ incrementToken: true, hide: true, clearDom: true });

  if (message) {
    typeSubtitle(message);
  }

  if (!isDashboardOpen() && inputContainer?.style.display !== 'block') {
    setMouseInteractive(false);
  }
}

function handleCandidateClick(event) {
  const item = event.target.closest('.file-open-candidate-item');
  if (!item || !currentPage) return;

  const candidate = currentPage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateSelection(candidate);
}

function renderCandidateList(candidates) {
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

function updateSelection(candidate) {
  currentCandidate = candidate;

  if (fileOpenConfirmBtn) {
    fileOpenConfirmBtn.disabled = !candidate?.id;
  }

  if (fileOpenSelectedSummary) {
    if (!candidate) {
      fileOpenSelectedSummary.textContent = '선택된 항목이 없습니다.';
    } else {
      const typeLabel = candidate.is_folder
        ? '폴더'
        : candidate.category || formatExtensionLabel(candidate.extension);
      fileOpenSelectedSummary.textContent = `${typeLabel}을 선택했어요. 열기를 누르면 진행합니다.`;
    }
  }

  if (fileOpenCandidateList) {
    for (const element of fileOpenCandidateList.querySelectorAll('.file-open-candidate-item')) {
      element.classList.toggle('selected', element.dataset.candidateId === candidate?.id);
    }
  }
}

async function confirmPendingFileOpen() {
  if (!currentCandidate?.id || !fileOpenConfirmBtn || confirmInFlight) return;

  const activeToken = requestToken;
  const candidate = currentCandidate;

  confirmInFlight = true;
  fileOpenConfirmBtn.disabled = true;
  fileOpenConfirmBtn.textContent = '여는 중...';

  try {
    const result = await confirmFileOpen(candidate.id);

    if (activeToken !== requestToken) return;

    if (result.ok) {
      hideFileOpenConfirmation(result.message || '열었어.');
    } else {
      confirmInFlight = false;
      typeSubtitle(result.message || '파일/폴더를 열 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    confirmInFlight = false;
    console.error('🚨 파일/폴더 열기 확인 실패:', error);
    typeSubtitle('파일/폴더 열기 요청 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !fileOpenModal?.classList.contains('hidden')) {
      fileOpenConfirmBtn.disabled = confirmInFlight || !currentCandidate?.id;
      fileOpenConfirmBtn.textContent = '열기';
    }
  }
}

async function showNextFileOpenCandidates() {
  if (!currentPage?.request_id || currentPage.next_offset == null) return;
  if (!fileOpenNextBtn || nextInFlight) return;

  const activeToken = requestToken;
  const requestId = currentPage.request_id;
  const nextOffset = currentPage.next_offset;

  nextInFlight = true;
  fileOpenNextBtn.disabled = true;
  fileOpenNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextFileOpenCandidates(requestId, nextOffset);

    if (activeToken !== requestToken) return;

    if (response.ok && response.candidate_page) {
      showFileOpenCandidates(response.candidate_page);
    } else {
      nextInFlight = false;
      typeSubtitle(response.message || '더 보여줄 후보가 없어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    nextInFlight = false;
    console.error('🚨 파일/폴더 후보 다음 페이지 조회 실패:', error);
    typeSubtitle('다음 후보를 불러오지 못했어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !fileOpenModal?.classList.contains('hidden')) {
      fileOpenNextBtn.textContent = '다음';
      fileOpenNextBtn.disabled = nextInFlight || !currentPage?.has_more;
    }
  }
}

function resetButtonsForPage(page) {
  if (fileOpenConfirmBtn) {
    fileOpenConfirmBtn.textContent = '열기';
    fileOpenConfirmBtn.disabled = true;
  }

  if (fileOpenNextBtn) {
    fileOpenNextBtn.textContent = '다음';
    fileOpenNextBtn.classList.toggle('hidden', !page.has_more);
    fileOpenNextBtn.disabled = !page.has_more;
  }
}

function resetModalState({ incrementToken = false, hide = false, clearDom = false } = {}) {
  if (incrementToken) requestToken += 1;

  confirmInFlight = false;
  nextInFlight = false;
  currentCandidate = null;
  currentPage = null;

  if (hide) fileOpenModal?.classList.add('hidden');
  if (clearDom && fileOpenCandidateList) fileOpenCandidateList.innerHTML = '';
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
}

function setMouseInteractive(enabled) {
  ipcRenderer.send('set-focusable', enabled);
  if (enabled) {
    ipcRenderer.send('set-ignore-mouse-events', false);
  } else {
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
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

module.exports = {
  initFileOpenModal,
  showFileOpenConfirmation,
  showFileOpenCandidates,
};
