const { API_PATHS, buildServerUrl } = require('../config/appConfig');

async function fetchServerStatus() {
  const response = await fetch(buildServerUrl(API_PATHS.status), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`서버 상태 응답 오류: ${response.status}`);
  }

  return response.json();
}

module.exports = { fetchServerStatus };
