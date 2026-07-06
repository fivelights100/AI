const { fetchServerStatus } = require('../system/serverStatusClient');
const { fetchFileSearchStatus } = require('../files/fileSearchClient');
const { getServerBaseUrl } = require('../config/appConfig');
const { escapeHtml } = require('../shared/html');

async function renderSystemStatus() {
  const systemStatusContainer = document.getElementById('system-status-container');
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

module.exports = { renderSystemStatus };
