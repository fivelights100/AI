const {
  fetchFilesystemSettings,
  updateFilesystemSettings,
  acceptFilesystemTerms,
} = require('../filesystem/filesystemSettingsClient');
const { escapeHtml } = require('../shared/html');

let currentSettings = null;
let subtitle = () => {};
let termsCountdownTimer = null;

function initFilesystemSettingsView({ typeSubtitle } = {}) {
  subtitle = typeof typeSubtitle === 'function' ? typeSubtitle : () => {};

  document.getElementById('refresh-filesystem-settings-btn')?.addEventListener('click', renderFilesystemSettings);
  document.getElementById('filesystem-settings-container')?.addEventListener('change', handleSettingsChange);
  document.getElementById('filesystem-settings-container')?.addEventListener('click', handleSettingsClick);

  bindTermsModal();
  bindDeleteWarningModal();
  renderFilesystemSettings();
}

async function renderFilesystemSettings() {
  const container = document.getElementById('filesystem-settings-container');
  if (!container) return;
  container.innerHTML = '<p>파일 시스템 설정을 불러오는 중...</p>';

  try {
    const response = await fetchFilesystemSettings();
    currentSettings = response.settings;
    container.innerHTML = renderSettings(currentSettings, response.message);
  } catch (error) {
    container.innerHTML = `<p class="settings-error">${escapeHtml(error.message || '파일 시스템 설정을 불러오지 못했습니다.')}</p>`;
  }
}

function renderSettings(settings, message = '') {
  const disabled = !settings.enabled;
  const allowed = new Set(settings.safety?.allowed_extensions || []);
  const groups = settings.safety?.extension_groups || [];
  const userPaths = settings.safety?.user_blocked_paths || [];
  const fixedPaths = settings.safety?.fixed_blocked_paths || [];

  return `
    ${message ? `<p class="settings-hint">${escapeHtml(message)}</p>` : ''}
    <section class="filesystem-section">
      <div class="filesystem-switch-row">
        <div>
          <h3>파일 시스템 활성화</h3>
          <p>꺼져 있으면 AI 파일 검색, 열기, 수정, 삭제, 복사, 이동 기능이 모두 차단됩니다.</p>
        </div>
        ${renderSwitch('filesystem-enabled-switch', settings.enabled, false, '파일 시스템 활성화')}
      </div>
    </section>

    <section class="filesystem-section ${disabled ? 'disabled' : ''}">
      <h3>권한</h3>
      <div class="filesystem-permission-grid">
        ${renderPermissionCard('검색', '인덱싱/검색/열기', true, true, disabled)}
        ${renderPermissionCard('수정', '이름 변경, 생성, 내용 수정, 복사, 이동', Boolean(settings.permissions?.modify), false, disabled, 'filesystem-modify-switch')}
        ${renderPermissionCard('삭제', '휴지통 이동 삭제', Boolean(settings.permissions?.delete), false, disabled, 'filesystem-delete-switch')}
      </div>
    </section>

    <section class="filesystem-section ${disabled ? 'disabled' : ''}">
      <h3>안전</h3>
      <div class="filesystem-safety-grid">
        <div class="filesystem-safety-card">
          <h4>고정 제한 경로</h4>
          <p>현재 고정 차단은 Windows 시스템 폴더만 적용됩니다.</p>
          <ul class="filesystem-path-list">
            ${fixedPaths.map((path) => `<li>${escapeHtml(path)}</li>`).join('')}
          </ul>
        </div>
        <div class="filesystem-safety-card">
          <h4>사용자 제한 경로</h4>
          <p>추가한 경로와 그 하위 항목은 파일 시스템 작업에서 차단됩니다.</p>
          <div class="filesystem-path-add-row">
            <input id="filesystem-user-blocked-path-input" type="text" placeholder="예: D:\\Private" ${disabled ? 'disabled' : ''}>
            <button id="filesystem-add-blocked-path-btn" class="secondary-btn" ${disabled ? 'disabled' : ''}>추가</button>
          </div>
          <ul class="filesystem-path-list">
            ${userPaths.length ? userPaths.map((path, index) => `
              <li>
                <span>${escapeHtml(path)}</span>
                <button class="filesystem-remove-path-btn secondary-btn" data-index="${index}" ${disabled ? 'disabled' : ''}>삭제</button>
              </li>
            `).join('') : '<li>추가된 사용자 제한 경로가 없습니다.</li>'}
          </ul>
        </div>
      </div>

      <div class="filesystem-extension-panel">
        <h4>허용 확장자</h4>
        <p>허용한 확장자만 파일 시스템 작업 대상이 됩니다. 실행 확장자는 사용자가 직접 허용할 수 있으니 신중하게 선택하세요. 기본값은 .txt 하나입니다.</p>
        <div class="filesystem-extension-groups">
          ${groups.map((group) => renderExtensionGroup(group, allowed, disabled)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderSwitch(id, checked, disabled, label) {
  return `
    <label class="switch-control" aria-label="${escapeHtml(label)}">
      <input id="${id}" type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span class="switch-slider"></span>
    </label>
  `;
}

function renderPermissionCard(title, description, enabled, locked, disabled, switchId = '') {
  return `
    <div class="filesystem-permission-card">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
        ${locked ? '<span class="permission-lock-label">항상 허용 · 변경 불가</span>' : ''}
      </div>
      ${renderSwitch(switchId || `filesystem-${title}-switch`, enabled, locked || disabled, title)}
    </div>
  `;
}

function renderExtensionGroup(group, allowed, disabled) {
  const locked = false;
  return `
    <div class="filesystem-extension-group ${locked ? 'locked' : ''}">
      <h5>${escapeHtml(group.label)}</h5>
      <p>${escapeHtml(group.description || '')}</p>
      <div class="filesystem-extension-checkboxes">
        ${(group.extensions || []).map((extension) => {
          const checked = allowed.has(extension);
          return `
            <label class="filesystem-extension-checkbox">
              <input type="checkbox" class="filesystem-extension-input" value="${escapeHtml(extension)}" ${checked ? 'checked' : ''} ${locked || disabled ? 'disabled' : ''}>
              <span>.${escapeHtml(extension)}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function handleSettingsChange(event) {
  const target = event.target;
  if (!currentSettings || !target) return;

  if (target.id === 'filesystem-enabled-switch') {
    if (target.checked) {
      if (currentSettings.terms?.show_terms_modal && !currentSettings.terms?.accepted) {
        target.checked = false;
        showTermsModal();
        return;
      }
      await saveSettings({ enabled: true });
      return;
    }
    await saveSettings({ enabled: false });
    return;
  }

  if (target.id === 'filesystem-modify-switch') {
    await saveSettings({ permissions: { modify: target.checked } });
    return;
  }

  if (target.id === 'filesystem-delete-switch') {
    if (target.checked && !currentSettings.permissions?.delete) {
      target.checked = false;
      showDeleteWarningModal();
      return;
    }
    await saveSettings({ permissions: { delete: false } });
    return;
  }

  if (target.classList.contains('filesystem-extension-input')) {
    const allowed = Array.from(document.querySelectorAll('.filesystem-extension-input:checked'))
      .map((input) => input.value)
      .filter(Boolean);
    await saveSettings({ safety: { allowed_extensions: allowed } });
  }
}

async function handleSettingsClick(event) {
  const target = event.target;
  if (!currentSettings || !target) return;

  if (target.id === 'filesystem-add-blocked-path-btn') {
    const input = document.getElementById('filesystem-user-blocked-path-input');
    const value = input?.value?.trim();
    if (!value) {
      subtitle('추가할 제한 경로를 입력해줘.');
      return;
    }
    const paths = [...(currentSettings.safety?.user_blocked_paths || []), value];
    await saveSettings({ safety: { user_blocked_paths: paths } });
    return;
  }

  if (target.classList.contains('filesystem-remove-path-btn')) {
    const index = Number(target.dataset.index);
    const paths = [...(currentSettings.safety?.user_blocked_paths || [])];
    if (Number.isInteger(index) && index >= 0 && index < paths.length) {
      paths.splice(index, 1);
      await saveSettings({ safety: { user_blocked_paths: paths } });
    }
  }
}

async function saveSettings(payload) {
  try {
    const response = await updateFilesystemSettings(payload);
    currentSettings = response.settings;
    subtitle(response.ok ? '파일 시스템 설정을 저장했어.' : response.message);
    await renderFilesystemSettings();
  } catch (error) {
    subtitle(error.message || '파일 시스템 설정 저장에 실패했어.');
    await renderFilesystemSettings();
  }
}

function bindTermsModal() {
  document.getElementById('filesystem-terms-close-btn')?.addEventListener('click', hideTermsModal);
  document.getElementById('filesystem-terms-cancel-btn')?.addEventListener('click', hideTermsModal);
  document.getElementById('filesystem-terms-accept-btn')?.addEventListener('click', async () => {
    try {
      const response = await acceptFilesystemTerms();
      currentSettings = response.settings;
      hideTermsModal();
      subtitle('파일 시스템 기능을 활성화했어.');
      await renderFilesystemSettings();
    } catch (error) {
      subtitle(error.message || '약관 동의 저장에 실패했어.');
    }
  });
}

function showTermsModal() {
  const modal = document.getElementById('filesystem-terms-modal');
  const button = document.getElementById('filesystem-terms-accept-btn');
  if (!modal || !button) return;

  clearInterval(termsCountdownTimer);
  let remaining = 7;
  button.disabled = true;
  button.textContent = `${remaining}초 후 동의 가능`;
  modal.classList.remove('hidden');

  termsCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(termsCountdownTimer);
      button.disabled = false;
      button.textContent = '동의하고 활성화';
    } else {
      button.textContent = `${remaining}초 후 동의 가능`;
    }
  }, 1000);
}

function hideTermsModal() {
  clearInterval(termsCountdownTimer);
  document.getElementById('filesystem-terms-modal')?.classList.add('hidden');
}

function bindDeleteWarningModal() {
  document.getElementById('filesystem-delete-warning-close-btn')?.addEventListener('click', hideDeleteWarningModal);
  document.getElementById('filesystem-delete-warning-cancel-btn')?.addEventListener('click', hideDeleteWarningModal);
  document.getElementById('filesystem-delete-warning-accept-btn')?.addEventListener('click', async () => {
    hideDeleteWarningModal();
    await saveSettings({ permissions: { delete: true } });
  });
}

function showDeleteWarningModal() {
  document.getElementById('filesystem-delete-warning-modal')?.classList.remove('hidden');
}

function hideDeleteWarningModal() {
  document.getElementById('filesystem-delete-warning-modal')?.classList.add('hidden');
}

module.exports = {
  initFilesystemSettingsView,
  renderFilesystemSettings,
};
