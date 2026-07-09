const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchNextFileRenameCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesRenameNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`파일 이름 변경 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function previewFileRename(candidateId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesRenamePreview), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId }),
  });

  if (!response.ok) {
    throw new Error(`파일 이름 변경 미리보기 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function confirmFileRename(editId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesRenameConfirm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edit_id: editId }),
  });

  if (!response.ok) {
    throw new Error(`파일 이름 변경 확인 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchNextFileRenameCandidates,
  previewFileRename,
  confirmFileRename,
};
