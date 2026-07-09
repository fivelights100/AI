const { ipcRenderer } = require('electron');
const { escapeHtml } = require('../shared/html');

function setMouseInteractive(enabled) {
  ipcRenderer.send('set-focusable', Boolean(enabled));
  if (enabled) {
    ipcRenderer.send('set-ignore-mouse-events', false);
  } else {
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
}

function restoreMouseInteractivity({ isDashboardOpen = () => false, inputContainer = null } = {}) {
  const inputVisible = inputContainer?.classList?.contains('visible') || inputContainer?.style?.display === 'block';
  setMouseInteractive(isDashboardOpen() || inputVisible);
}

function getParentPath(pathValue) {
  const rawPath = String(pathValue || '');
  const separatorIndex = Math.max(rawPath.lastIndexOf('\\'), rawPath.lastIndexOf('/'));
  return separatorIndex > 0 ? rawPath.slice(0, separatorIndex) : '';
}

function formatExtensionLabel(extension) {
  return extension ? `.${extension} 파일` : '파일';
}

function candidateTypeLabel(candidate) {
  if (candidate?.is_folder) return '폴더';
  return candidate?.category || formatExtensionLabel(candidate?.extension);
}

function renderCandidateButtons(candidates, options = {}) {
  const itemClass = options.itemClass || 'file-operation-candidate-item';
  const nameClass = options.nameClass || 'file-operation-candidate-name';
  const metaClass = options.metaClass || 'file-operation-candidate-meta';
  const emptyName = options.emptyName || '항목 이름 없음';
  const metaBuilder = options.metaBuilder || ((candidate) => {
    const parentPath = candidate.parent_path || getParentPath(candidate.path) || '-';
    return `${candidateTypeLabel(candidate)} · ${parentPath}`;
  });

  return candidates
    .map((candidate) => `
      <button class="${escapeHtml(itemClass)}" type="button" data-candidate-id="${escapeHtml(candidate.id)}">
        <span class="${escapeHtml(nameClass)}">${escapeHtml(candidate.name || emptyName)}</span>
        <span class="${escapeHtml(metaClass)}">${escapeHtml(metaBuilder(candidate))}</span>
      </button>
    `)
    .join('');
}

function markSelectedCandidate(listElement, itemSelector, candidateId) {
  if (!listElement) return;
  for (const element of listElement.querySelectorAll(itemSelector)) {
    element.classList.toggle('selected', element.dataset.candidateId === candidateId);
  }
}

module.exports = {
  setMouseInteractive,
  restoreMouseInteractivity,
  getParentPath,
  formatExtensionLabel,
  candidateTypeLabel,
  renderCandidateButtons,
  markSelectedCandidate,
};
