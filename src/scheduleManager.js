// src/scheduleManager.js
const API_BASE_URL = 'http://localhost:3000/api/schedules';
let cachedSchedules = [];
let alarmWatcher = null;

// 🌟 [핵심 변경] 로컬 파일 대신 서버에서 일정을 가져옵니다 (비동기 처리)
async function fetchSchedulesFromServer() {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) throw new Error('서버 응답 오류');
    cachedSchedules = await response.json();
    return cachedSchedules;
  } catch (error) { 
    console.error("🚨 서버 일정 로딩 실패:", error); 
    return cachedSchedules; // 실패 시 기존 캐시 반환
  }
}

// 🌟 getSchedules 함수도 비동기(async)로 변경
async function getSchedules() {
  return await fetchSchedulesFromServer();
}

async function addSchedule(scheduleObj) {
  try {
    // Rust 서버의 NaiveTime 규격("HH:MM:SS")에 맞추기 위한 포맷팅
    let timeStr = scheduleObj.time || scheduleObj.alarmTime || null;
    if (timeStr && timeStr.length === 5) timeStr += ":00";

    await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: scheduleObj.topic || scheduleObj.title || "새 일정", 
        event_date: scheduleObj.date,
        event_time: timeStr,
        location: scheduleObj.location || null,
        memo: scheduleObj.memo || null
      })
    });
    console.log("서버에 일정이 안전하게 기록되었습니다.");
  } catch (error) {
    console.error("🚨 서버 추가 실패:", error);
  }
}

// 🌟 클라우드 DB에 삭제 명령 전송 (DELETE)
async function deleteSchedule(id) {
  try {
    await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE'
    });
    console.log(`일정 ID ${id} 삭제 완료`);
  } catch (error) {
    console.error("🚨 서버 삭제 실패:", error);
  }
}
// 수정 기능 대기 중
function updateSchedule(id, updatedObj) { console.log("서버 수정 기능 구현 대기 중"); }

function startAlarmWatcher(onAlarmTriggered) {
  if (alarmWatcher) clearInterval(alarmWatcher);
  alarmWatcher = setInterval(async () => {
    // 알람 기능도 추후 서버 동기화 구조에 맞게 개선할 예정입니다.
  }, 30000);
}

module.exports = { addSchedule, getSchedules, deleteSchedule, updateSchedule, startAlarmWatcher, fetchSchedulesFromServer };