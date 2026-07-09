const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchNextFileContentEditCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesContentEditNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`파일 내용 수정 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function previewFileContentEdit(candidateId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesContentEditPreview), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: candidateId }),
  });

  if (!response.ok) {
    throw new Error(`파일 내용 수정 미리보기 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function confirmFileContentEdit(editId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesContentEditConfirm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edit_id: editId }),
  });

  if (!response.ok) {
    throw new Error(`파일 내용 수정 확인 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchNextFileContentEditCandidates,
  previewFileContentEdit,
  confirmFileContentEdit,
};
