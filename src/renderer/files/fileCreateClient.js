const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchNextFileCreateCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesCreateNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`파일 생성 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function previewFileCreate(candidateId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesCreatePreview), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId }),
  });

  if (!response.ok) {
    throw new Error(`파일 생성 미리보기 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function confirmFileCreate(editId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesCreateConfirm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edit_id: editId }),
  });

  if (!response.ok) {
    throw new Error(`파일 생성 확인 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchNextFileCreateCandidates,
  previewFileCreate,
  confirmFileCreate,
};
