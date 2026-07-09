const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchNextTransferSourceCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesTransferSourceNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`복사/이동 원본 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function fetchNextTransferDestinationCandidates(requestId, offset) {
  const response = await fetch(buildServerUrl(API_PATHS.filesTransferDestinationNext), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, offset }),
  });

  if (!response.ok) {
    throw new Error(`복사/이동 목적지 후보 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function previewFileTransfer(requestId, sourceId, destinationId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesTransferPreview), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: requestId,
      source_id: sourceId,
      destination_id: destinationId,
    }),
  });

  if (!response.ok) {
    throw new Error(`복사/이동 미리보기 응답 오류: ${response.status}`);
  }

  return response.json();
}

async function confirmFileTransfer(transferId) {
  const response = await fetch(buildServerUrl(API_PATHS.filesTransferConfirm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transfer_id: transferId }),
  });

  if (!response.ok) {
    throw new Error(`복사/이동 확인 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  fetchNextTransferSourceCandidates,
  fetchNextTransferDestinationCandidates,
  previewFileTransfer,
  confirmFileTransfer,
};
