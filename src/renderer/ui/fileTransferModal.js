const {
  fetchNextTransferSourceCandidates,
  fetchNextTransferDestinationCandidates,
  previewFileTransfer,
  confirmFileTransfer,
} = require('../files/fileTransferClient');
const { setMouseInteractive, restoreMouseInteractivity: restoreMouseInteractivityShared, getParentPath, renderCandidateButtons, markSelectedCandidate } = require('./fileOperationUi');

let sourceModal = null;
let sourceMessage = null;
let sourceCandidateList = null;
let sourceSelectedSummary = null;
let sourceNextBtn = null;
let sourceContinueBtn = null;
let sourceCancelBtn = null;
let sourceCloseBtn = null;

let destinationModal = null;
let destinationMessage = null;
let destinationCandidateList = null;
let destinationSelectedSummary = null;
let destinationNextBtn = null;
let destinationPreviewBtn = null;
let destinationBackBtn = null;
let destinationCancelBtn = null;
let destinationCloseBtn = null;

let confirmModal = null;
let confirmOperation = null;
let confirmTarget = null;
let confirmSource = null;
let confirmDestination = null;
let confirmWarning = null;
let confirmApplyBtn = null;
let confirmBackBtn = null;
let confirmCancelBtn = null;
let confirmCloseBtn = null;

let inputContainer = null;
let typeSubtitle = () => {};
let isDashboardOpen = () => false;

let currentPending = null;
let sourcePage = null;
let destinationPage = null;
let currentSource = null;
let currentDestination = null;
let currentConfirmation = null;
let requestToken = 0;
let sourceNextInFlight = false;
let destinationNextInFlight = false;
let previewInFlight = false;
let confirmInFlight = false;
let initialized = false;

function initFileTransferModal(options = {}) {
  if (initialized) return;

  typeSubtitle = options.typeSubtitle || typeSubtitle;
  isDashboardOpen = options.isDashboardOpen || isDashboardOpen;
  inputContainer = options.inputContainer || inputContainer;

  sourceModal = document.getElementById('file-transfer-source-modal');
  sourceMessage = document.getElementById('file-transfer-source-message');
  sourceCandidateList = document.getElementById('file-transfer-source-candidate-list');
  sourceSelectedSummary = document.getElementById('file-transfer-source-selected-summary');
  sourceNextBtn = document.getElementById('file-transfer-source-next-btn');
  sourceContinueBtn = document.getElementById('file-transfer-source-continue-btn');
  sourceCancelBtn = document.getElementById('file-transfer-source-cancel-btn');
  sourceCloseBtn = document.getElementById('file-transfer-source-close-btn');

  destinationModal = document.getElementById('file-transfer-destination-modal');
  destinationMessage = document.getElementById('file-transfer-destination-message');
  destinationCandidateList = document.getElementById('file-transfer-destination-candidate-list');
  destinationSelectedSummary = document.getElementById('file-transfer-destination-selected-summary');
  destinationNextBtn = document.getElementById('file-transfer-destination-next-btn');
  destinationPreviewBtn = document.getElementById('file-transfer-destination-preview-btn');
  destinationBackBtn = document.getElementById('file-transfer-destination-back-btn');
  destinationCancelBtn = document.getElementById('file-transfer-destination-cancel-btn');
  destinationCloseBtn = document.getElementById('file-transfer-destination-close-btn');

  confirmModal = document.getElementById('file-transfer-confirm-modal');
  confirmOperation = document.getElementById('file-transfer-confirm-operation');
  confirmTarget = document.getElementById('file-transfer-confirm-target');
  confirmSource = document.getElementById('file-transfer-confirm-source');
  confirmDestination = document.getElementById('file-transfer-confirm-destination');
  confirmWarning = document.getElementById('file-transfer-confirm-warning');
  confirmApplyBtn = document.getElementById('file-transfer-apply-btn');
  confirmBackBtn = document.getElementById('file-transfer-back-btn');
  confirmCancelBtn = document.getElementById('file-transfer-confirm-cancel-btn');
  confirmCloseBtn = document.getElementById('file-transfer-confirm-close-btn');

  sourceCandidateList?.addEventListener('click', handleSourceCandidateClick);
  sourceNextBtn?.addEventListener('click', showNextSourceCandidates);
  sourceContinueBtn?.addEventListener('click', showDestinationModal);
  sourceCancelBtn?.addEventListener('click', () => hideAllTransferModals('좋아, 복사/이동하지 않을게.'));
  sourceCloseBtn?.addEventListener('click', () => hideAllTransferModals('좋아, 복사/이동하지 않을게.'));
  sourceModal?.addEventListener('click', (event) => {
    if (event.target === sourceModal) hideAllTransferModals('좋아, 복사/이동하지 않을게.');
  });

  destinationCandidateList?.addEventListener('click', handleDestinationCandidateClick);
  destinationNextBtn?.addEventListener('click', showNextDestinationCandidates);
  destinationPreviewBtn?.addEventListener('click', previewSelectedTransfer);
  destinationBackBtn?.addEventListener('click', showSourceModalAgain);
  destinationCancelBtn?.addEventListener('click', () => hideAllTransferModals('좋아, 복사/이동하지 않을게.'));
  destinationCloseBtn?.addEventListener('click', () => hideAllTransferModals('좋아, 복사/이동하지 않을게.'));
  destinationModal?.addEventListener('click', (event) => {
    if (event.target === destinationModal) hideAllTransferModals('좋아, 복사/이동하지 않을게.');
  });

  confirmApplyBtn?.addEventListener('click', confirmPendingTransfer);
  confirmBackBtn?.addEventListener('click', showDestinationModalAgain);
  confirmCancelBtn?.addEventListener('click', () => hideAllTransferModals('좋아, 복사/이동하지 않을게.'));
  confirmCloseBtn?.addEventListener('click', () => hideAllTransferModals('좋아, 복사/이동하지 않을게.'));
  confirmModal?.addEventListener('click', (event) => {
    if (event.target === confirmModal) hideAllTransferModals('좋아, 복사/이동하지 않을게.');
  });

  initialized = true;
}

function showFileTransferCandidates(pending) {
  if (!sourceModal || !pending?.source_page || !pending?.destination_page) return;

  resetTransferState({ incrementToken: true, hide: true });
  currentPending = pending;
  sourcePage = pending.source_page;
  destinationPage = pending.destination_page;
  const activeToken = requestToken;

  if (sourceMessage) {
    sourceMessage.textContent = sourcePage.has_more
      ? '복사/이동할 원본을 선택해 주세요. 원하는 항목이 없으면 다음을 눌러 더 볼 수 있어요.'
      : '복사/이동할 원본을 선택해 주세요.';
  }

  renderSourceCandidates(sourcePage.candidates || []);
  renderDestinationCandidates(destinationPage.candidates || []);
  updateSourceSelection(null);
  updateDestinationSelection(null);
  resetSourceButtons(sourcePage);
  resetDestinationButtons(destinationPage);

  window.requestAnimationFrame(() => {
    if (activeToken !== requestToken) return;
    sourceModal.classList.remove('hidden');
    setMouseInteractive(true);
  });
}

function handleSourceCandidateClick(event) {
  const item = event.target.closest('.file-transfer-candidate-item');
  if (!item || !sourcePage) return;

  const candidate = sourcePage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateSourceSelection(candidate);
}

function handleDestinationCandidateClick(event) {
  const item = event.target.closest('.file-transfer-candidate-item');
  if (!item || !destinationPage) return;

  const candidate = destinationPage.candidates.find((entry) => entry.id === item.dataset.candidateId);
  if (candidate) updateDestinationSelection(candidate);
}

function renderSourceCandidates(candidates) {
  if (!sourceCandidateList) return;

  sourceCandidateList.innerHTML = renderCandidateButtons(candidates, {
    itemClass: 'file-transfer-candidate-item',
    nameClass: 'file-transfer-candidate-name',
    metaClass: 'file-transfer-candidate-meta',
    emptyName: '항목 이름 없음',
    metaBuilder: (candidate) => `${candidate.category || (candidate.is_folder ? '폴더' : '파일')} · ${candidate.parent_path || getParentPath(candidate.path) || '-'}`,
  });
}

function renderDestinationCandidates(candidates) {
  if (!destinationCandidateList) return;

  destinationCandidateList.innerHTML = renderCandidateButtons(candidates, {
    itemClass: 'file-transfer-candidate-item',
    nameClass: 'file-transfer-candidate-name',
    metaClass: 'file-transfer-candidate-meta',
    emptyName: '폴더 이름 없음',
    metaBuilder: (candidate) => `${candidate.category || '목적지 폴더'} · ${candidate.parent_path || getParentPath(candidate.path) || '-'}`,
  });
}

function updateSourceSelection(candidate) {
  currentSource = candidate;

  if (sourceContinueBtn) sourceContinueBtn.disabled = !candidate?.id;
  if (sourceSelectedSummary) {
    sourceSelectedSummary.textContent = candidate
      ? '원본을 선택했어요. 이제 목적지 위치를 선택해 주세요.'
      : '선택된 원본이 없습니다.';
  }
  markSelectedCandidate(sourceCandidateList, '.file-transfer-candidate-item', candidate?.id);
}

function updateDestinationSelection(candidate) {
  currentDestination = candidate;

  if (destinationPreviewBtn) destinationPreviewBtn.disabled = !candidate?.id || !currentSource?.id;
  if (destinationSelectedSummary) {
    destinationSelectedSummary.textContent = candidate
      ? '목적지를 선택했어요. 작업 내용을 확인하려면 다음 단계로 진행해 주세요.'
      : '선택된 목적지가 없습니다.';
  }
  if (destinationCandidateList) {
    for (const element of destinationCandidateList.querySelectorAll('.file-transfer-candidate-item')) {
      element.classList.toggle('selected', element.dataset.candidateId === candidate?.id);
    }
  }
}

function showDestinationModal() {
  if (!currentSource?.id || !destinationModal) return;

  sourceModal?.classList.add('hidden');
  if (destinationMessage) {
    destinationMessage.textContent = destinationPage?.has_more
      ? '복사/이동할 위치를 선택해 주세요. 원하는 위치가 없으면 다음을 눌러 더 볼 수 있어요.'
      : '복사/이동할 위치를 선택해 주세요.';
  }
  renderDestinationCandidates(destinationPage?.candidates || []);
  updateDestinationSelection(currentDestination);
  resetDestinationButtons(destinationPage);
  destinationModal.classList.remove('hidden');
  setMouseInteractive(true);
}

function showSourceModalAgain() {
  destinationModal?.classList.add('hidden');
  sourceModal?.classList.remove('hidden');
}

function showDestinationModalAgain() {
  confirmModal?.classList.add('hidden');
  destinationModal?.classList.remove('hidden');
}

async function showNextSourceCandidates() {
  if (!sourcePage?.request_id || sourcePage.next_offset == null || sourceNextInFlight) return;

  const activeToken = requestToken;
  sourceNextInFlight = true;
  sourceNextBtn.disabled = true;
  sourceNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextTransferSourceCandidates(sourcePage.request_id, sourcePage.next_offset);
    if (activeToken !== requestToken) return;

    if (response.ok && response.source_page) {
      sourcePage = response.source_page;
      renderSourceCandidates(sourcePage.candidates || []);
      updateSourceSelection(null);
      resetSourceButtons(sourcePage);
      if (sourceMessage) {
        sourceMessage.textContent = sourcePage.has_more
          ? '다음 원본 후보를 가져왔어요. 원하는 항목이 없으면 다음을 더 눌러볼 수 있어요.'
          : '마지막 원본 후보 목록이에요. 복사/이동할 항목을 선택해 주세요.';
      }
    } else {
      typeSubtitle(response.message || '더 보여줄 원본 후보가 없어.');
      sourceNextBtn.classList.add('hidden');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    console.error('🚨 복사/이동 원본 다음 후보 실패:', error);
    typeSubtitle('다음 원본 후보를 불러오는 중 문제가 생겼어.');
  } finally {
    if (activeToken === requestToken) {
      sourceNextInFlight = false;
      resetSourceButtons(sourcePage);
    }
  }
}

async function showNextDestinationCandidates() {
  if (!destinationPage?.request_id || destinationPage.next_offset == null || destinationNextInFlight) return;

  const activeToken = requestToken;
  destinationNextInFlight = true;
  destinationNextBtn.disabled = true;
  destinationNextBtn.textContent = '불러오는 중...';

  try {
    const response = await fetchNextTransferDestinationCandidates(destinationPage.request_id, destinationPage.next_offset);
    if (activeToken !== requestToken) return;

    if (response.ok && response.destination_page) {
      destinationPage = response.destination_page;
      renderDestinationCandidates(destinationPage.candidates || []);
      updateDestinationSelection(null);
      resetDestinationButtons(destinationPage);
      if (destinationMessage) {
        destinationMessage.textContent = destinationPage.has_more
          ? '다음 목적지 후보를 가져왔어요. 원하는 위치가 없으면 다음을 더 눌러볼 수 있어요.'
          : '마지막 목적지 후보 목록이에요. 위치를 선택해 주세요.';
      }
    } else {
      typeSubtitle(response.message || '더 보여줄 목적지 후보가 없어.');
      destinationNextBtn.classList.add('hidden');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    console.error('🚨 복사/이동 목적지 다음 후보 실패:', error);
    typeSubtitle('다음 목적지 후보를 불러오는 중 문제가 생겼어.');
  } finally {
    if (activeToken === requestToken) {
      destinationNextInFlight = false;
      resetDestinationButtons(destinationPage);
    }
  }
}

async function previewSelectedTransfer() {
  if (!currentPending?.request_id || !currentSource?.id || !currentDestination?.id || !destinationPreviewBtn || previewInFlight) return;

  const activeToken = requestToken;
  previewInFlight = true;
  destinationPreviewBtn.disabled = true;
  destinationPreviewBtn.textContent = '확인 중...';

  try {
    const response = await previewFileTransfer(currentPending.request_id, currentSource.id, currentDestination.id);
    if (activeToken !== requestToken) return;

    if (response.ok && response.confirmation) {
      currentConfirmation = response.confirmation;
      showTransferConfirmation(response.confirmation);
    } else {
      previewInFlight = false;
      typeSubtitle(response.message || '복사/이동 내용을 확인할 수 없었어.');
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    previewInFlight = false;
    console.error('🚨 복사/이동 미리보기 실패:', error);
    typeSubtitle('복사/이동 내용을 확인하는 중 문제가 생겼어. 서버 상태를 확인해줘.');
  } finally {
    if (activeToken === requestToken && !destinationModal?.classList.contains('hidden')) {
      destinationPreviewBtn.textContent = '작업 내용 확인';
      destinationPreviewBtn.disabled = previewInFlight || !currentDestination?.id || !currentSource?.id;
    }
  }
}

function showTransferConfirmation(confirmation) {
  previewInFlight = false;
  if (!confirmModal || !confirmation) return;

  destinationModal?.classList.add('hidden');

  if (confirmOperation) confirmOperation.textContent = confirmation.operation || '복사/이동';
  if (confirmTarget) confirmTarget.textContent = confirmation.target_kind || (confirmation.is_folder ? '폴더' : '파일');
  if (confirmSource) confirmSource.textContent = confirmation.source_path || '-';
  if (confirmDestination) confirmDestination.textContent = confirmation.destination_path || '-';
  if (confirmWarning) confirmWarning.textContent = confirmation.warning || '작업 내용을 확인한 뒤 적용해 주세요.';
  if (confirmApplyBtn) {
    confirmApplyBtn.disabled = !confirmation.transfer_id;
    confirmApplyBtn.textContent = confirmation.operation || '적용';
  }

  confirmModal.classList.remove('hidden');
  setMouseInteractive(true);
}

async function confirmPendingTransfer() {
  if (!currentConfirmation?.transfer_id || !confirmApplyBtn || confirmInFlight) return;

  const activeToken = requestToken;
  const transferId = currentConfirmation.transfer_id;
  const operation = currentConfirmation.operation || '적용';

  confirmInFlight = true;
  confirmApplyBtn.disabled = true;
  confirmApplyBtn.textContent = '진행 중...';

  try {
    const response = await confirmFileTransfer(transferId);
    if (activeToken !== requestToken) return;

    if (response.ok) {
      hideAllTransferModals(response.message || `선택한 항목을 ${operation}했어.`);
    } else {
      confirmInFlight = false;
      typeSubtitle(response.message || '복사/이동하지 못했어.');
      confirmApplyBtn.textContent = operation;
      confirmApplyBtn.disabled = false;
    }
  } catch (error) {
    if (activeToken !== requestToken) return;
    confirmInFlight = false;
    console.error('🚨 복사/이동 적용 실패:', error);
    typeSubtitle('복사/이동 중 문제가 생겼어. 서버 상태를 확인해줘.');
    confirmApplyBtn.textContent = operation;
    confirmApplyBtn.disabled = false;
  }
}

function resetSourceButtons(page) {
  if (sourceContinueBtn) {
    sourceContinueBtn.textContent = '목적지 선택';
    sourceContinueBtn.disabled = !currentSource?.id;
  }

  if (sourceNextBtn) {
    sourceNextBtn.textContent = '다음';
    sourceNextBtn.disabled = !page?.has_more || sourceNextInFlight;
    sourceNextBtn.classList.toggle('hidden', !page?.has_more);
  }
}

function resetDestinationButtons(page) {
  if (destinationPreviewBtn) {
    destinationPreviewBtn.textContent = '작업 내용 확인';
    destinationPreviewBtn.disabled = !currentDestination?.id || !currentSource?.id || previewInFlight;
  }

  if (destinationNextBtn) {
    destinationNextBtn.textContent = '다음';
    destinationNextBtn.disabled = !page?.has_more || destinationNextInFlight;
    destinationNextBtn.classList.toggle('hidden', !page?.has_more);
  }
}

function hideAllTransferModals(message) {
  resetTransferState({ incrementToken: true, hide: true });
  if (message) typeSubtitle(message);
  restoreMouseInteractivity();
}

function resetTransferState(options = {}) {
  if (options.incrementToken) requestToken += 1;

  currentPending = null;
  sourcePage = null;
  destinationPage = null;
  currentSource = null;
  currentDestination = null;
  currentConfirmation = null;
  sourceNextInFlight = false;
  destinationNextInFlight = false;
  previewInFlight = false;
  confirmInFlight = false;

  if (sourceContinueBtn) {
    sourceContinueBtn.textContent = '목적지 선택';
    sourceContinueBtn.disabled = true;
  }
  if (sourceNextBtn) {
    sourceNextBtn.textContent = '다음';
    sourceNextBtn.disabled = true;
    sourceNextBtn.classList.add('hidden');
  }
  if (destinationPreviewBtn) {
    destinationPreviewBtn.textContent = '작업 내용 확인';
    destinationPreviewBtn.disabled = true;
  }
  if (destinationNextBtn) {
    destinationNextBtn.textContent = '다음';
    destinationNextBtn.disabled = true;
    destinationNextBtn.classList.add('hidden');
  }
  if (confirmApplyBtn) {
    confirmApplyBtn.textContent = '적용';
    confirmApplyBtn.disabled = true;
  }
  if (sourceSelectedSummary) sourceSelectedSummary.textContent = '선택된 원본이 없습니다.';
  if (destinationSelectedSummary) destinationSelectedSummary.textContent = '선택된 목적지가 없습니다.';
  if (sourceCandidateList) sourceCandidateList.innerHTML = '';
  if (destinationCandidateList) destinationCandidateList.innerHTML = '';

  if (options.hide) {
    sourceModal?.classList.add('hidden');
    destinationModal?.classList.add('hidden');
    confirmModal?.classList.add('hidden');
  }
}

function restoreMouseInteractivity() {
  restoreMouseInteractivityShared({ isDashboardOpen, inputContainer });
}

module.exports = {
  initFileTransferModal,
  showFileTransferCandidates,
};
