const { API_PATHS, buildServerUrl } = require('../config/appConfig');

let cachedStatus = null;

async function fetchFileSearchStatus() {
  try {
    const response = await fetch(buildServerUrl(API_PATHS.filesStatus), {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`파일 검색 상태 응답 오류: ${response.status}`);
    }

    cachedStatus = await response.json();
    return cachedStatus;
  } catch (error) {
    console.error('🚨 파일 검색 상태 확인 실패:', error);
    return cachedStatus || {
      available: false,
      everything_running: false,
      message: error.message,
      install_hint: '서버가 실행 중인지 먼저 확인하세요.',
    };
  }
}

module.exports = {
  fetchFileSearchStatus,
};
