const { API_PATHS, buildServerUrl } = require('../config/appConfig');

let cachedSchedules = [];

function getSchedulesUrl(id) {
  const baseUrl = buildServerUrl(API_PATHS.schedules);
  return id ? `${baseUrl}/${id}` : baseUrl;
}

async function getSchedules() {
  try {
    const response = await fetch(getSchedulesUrl(), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`서버 일정 응답 오류: ${response.status}`);
    }

    cachedSchedules = await response.json();
    return cachedSchedules;
  } catch (error) {
    console.error('🚨 서버 일정 로딩 실패:', error);
    return cachedSchedules;
  }
}

async function deleteSchedule(id) {
  try {
    const response = await fetch(getSchedulesUrl(id), { method: 'DELETE' });

    if (!response.ok) {
      throw new Error(`서버 일정 삭제 응답 오류: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('🚨 서버 일정 삭제 실패:', error);
    return null;
  }
}

module.exports = {
  getSchedules,
  deleteSchedule,
};
