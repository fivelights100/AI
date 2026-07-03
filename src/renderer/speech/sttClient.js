const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function transcribeAudioBlob(audioBlob) {
  if (!audioBlob || audioBlob.size === 0) return null;

  const formData = new FormData();
  formData.append('file', audioBlob, 'command.webm');
  formData.append('language', 'ko');

  const response = await fetch(buildServerUrl(API_PATHS.stt), {
    method: 'POST',
    body: formData,
  });

  const data = await readJsonSafely(response);

  if (!response.ok) {
    const detail = formatSttError(data);
    throw new Error(`STT 서버 응답 오류: ${response.status}${detail ? ` - ${detail}` : ''}`);
  }

  return data?.text || null;
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function formatSttError(data) {
  if (!data?.error) return '';

  if (typeof data.error === 'string') {
    return data.error;
  }

  try {
    return JSON.stringify(data.error);
  } catch (_) {
    return String(data.error);
  }
}

module.exports = { transcribeAudioBlob };
