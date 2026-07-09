const { getServerBaseUrl } = require('../config/appConfig');

async function fetchFilesystemSettings() {
  const response = await fetch(`${getServerBaseUrl()}/api/filesystem/settings`);
  if (!response.ok) throw new Error(`파일 시스템 설정 조회 실패: ${response.status}`);
  return response.json();
}

async function updateFilesystemSettings(payload) {
  const response = await fetch(`${getServerBaseUrl()}/api/filesystem/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`파일 시스템 설정 저장 실패: ${response.status}`);
  return response.json();
}

async function acceptFilesystemTerms() {
  const response = await fetch(`${getServerBaseUrl()}/api/filesystem/terms/accept`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`파일 시스템 약관 동의 실패: ${response.status}`);
  return response.json();
}

module.exports = {
  fetchFilesystemSettings,
  updateFilesystemSettings,
  acceptFilesystemTerms,
};
