// src/scheduleManager.js
const fs = require('fs');
const path = require('path');

const scheduleFilePath = path.join(__dirname, '..', 'schedule.json');
let schedules = [];
let alarmWatcher = null;

function loadSchedules() {
  try {
    if (fs.existsSync(scheduleFilePath)) {
      schedules = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf-8'));
      
      // 🌟 [핵심 해결: 자가 치유 로직] ID가 없는 옛날 '유령 일정'들에 새 고유 번호를 부여합니다!
      let needsSave = false;
      schedules = schedules.map(sch => {
        if (!sch.id) {
          needsSave = true;
          // 기존 일정에 현재 시간 기반의 새 고유 ID 발급
          return { ...sch, id: Date.now() + Math.floor(Math.random() * 10000) }; 
        }
        return sch;
      });
      if (needsSave) saveSchedules(); // 치유된 데이터를 즉시 저장
    }
  } catch (error) { 
    console.error("🚨 일정 파일 로딩 실패:", error); 
  }
}

function saveSchedules() {
  try {
    fs.writeFileSync(scheduleFilePath, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (error) { 
    console.error("🚨 일정 파일 저장 실패:", error); 
  }
}

function addSchedule(scheduleObj) {
  scheduleObj.id = Date.now(); 
  schedules.push(scheduleObj);
  saveSchedules();
}

function getSchedules() {
  return schedules;
}

// 🌟 [안전성 강화] parseInt 대신 String으로 무조건 문자로 변환해서 완벽하게 비교합니다.
function deleteSchedule(id) {
  schedules = schedules.filter(sch => String(sch.id) !== String(id));
  saveSchedules();
}

function updateSchedule(id, updatedObj) {
  const index = schedules.findIndex(sch => String(sch.id) === String(id));
  if (index !== -1) {
    // 기존 ID를 유지한 채 데이터만 덮어씌웁니다.
    schedules[index] = { ...schedules[index], ...updatedObj, id: schedules[index].id };
    saveSchedules();
  }
}

function startAlarmWatcher(onAlarmTriggered) {
  if (alarmWatcher) clearInterval(alarmWatcher);
  alarmWatcher = setInterval(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const currentDateStr = `${year}-${month}-${day}`;
    const currentTimeStr = `${hours}:${minutes}`;

    schedules.forEach((sch) => {
      if (sch.isNotified) return;
      if (sch.date === currentDateStr && sch.alarmTime === currentTimeStr) {
        sch.isNotified = true;
        saveSchedules();
        onAlarmTriggered(sch);
      }
    });
  }, 30000);
}

loadSchedules(); // 모듈 로드 시 자가 치유 로직 바로 가동

module.exports = { addSchedule, getSchedules, deleteSchedule, updateSchedule, startAlarmWatcher };