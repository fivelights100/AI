const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchNextFileOpenCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesOpenNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`파일 열기 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function confirmFileOpen(candidateId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesOpenConfirm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId }),
  });

  if (!response.ok) {
    throw new Error(`파일 열기 확인 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchNextFileOpenCandidates,
  confirmFileOpen,
};
