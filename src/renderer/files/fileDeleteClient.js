const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchNextFileDeleteCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesDeleteNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`파일 삭제 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function previewFileDelete(candidateId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesDeletePreview), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId }),
  });

  if (!response.ok) {
    throw new Error(`파일 삭제 미리보기 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function confirmFileDelete(deleteId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesDeleteConfirm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete_id: deleteId }),
  });

  if (!response.ok) {
    throw new Error(`파일 삭제 확인 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchNextFileDeleteCandidates,
  previewFileDelete,
  confirmFileDelete,
};
