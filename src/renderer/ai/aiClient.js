const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function sendChatMessage(message, history) {
  const response = await fetch(buildServerUrl(API_PATHS.chat), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(`서버 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = { sendChatMessage };
