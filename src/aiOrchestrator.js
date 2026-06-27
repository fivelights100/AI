// src/aiOrchestrator.js
const { appSettings, chatHistory, saveChatHistory } = require('./configManager');
const { sendMessageToAI } = require('./aiRouter');
const { speakElevenLabs } = require('./audioEngine');
const { getSchedules, addSchedule, deleteSchedule, updateSchedule } = require('./scheduleManager');
const { buildSystemPrompt } = require('./promptBuilder');

// 엑셀 에이전트는 src 폴더 바깥(루트)에 있으므로 '../' 경로를 사용합니다.
const { createExcelFromBlueprint } = require('../excelAgent');

// 🌟 메인 컨트롤러에서 입력받은 텍스트와 UI 갱신 함수들을 넘겨받아 모든 처리를 지휘합니다.
async function processUserMessage(userText, renderSchedulesCallback, typeSubtitleCallback) {
  
  // 1. 사용자 메시지 기록
  const currentTime = new Date().toLocaleString('ko-KR');
  chatHistory.push({ role: 'user', content: userText, timestamp: currentTime });

  // 2. 현재 시간대 파악 및 감정 세팅
  const now = new Date();
  const currentTimeString = now.toLocaleString('ko-KR');
  const currentHour = now.getHours();

  let timeContext = "";
  if (currentHour >= 5 && currentHour < 12) timeContext = "지금은 아침이야. 활기차고 상쾌하게 하루를 응원해 줘.";
  else if (currentHour >= 12 && currentHour < 17) timeContext = "지금은 낮이야. 지치지 않게 힘을 주는 대화를 해 줘.";
  else if (currentHour >= 17 && currentHour < 23) timeContext = "지금은 저녁/밤이야. 오늘 하루도 수고했다는 따뜻한 위로와 편안함을 건네줘.";
  else timeContext = "지금은 모두가 잠든 늦은 새벽이야. 아주 차분하고 조용한 톤으로, 편안하게 쉴 수 있도록 다독여 줘.";

  // 3. 현재 일정 목록 파악
  const currentSchedules = getSchedules();
  const pendingSchedules = currentSchedules.filter(s => !s.isNotified);
  const scheduleContextStr = currentSchedules.length > 0 
    ? JSON.stringify(currentSchedules.map(s => ({ id: s.id, date: s.date, time: s.time, topic: s.topic })), null, 2)
    : "현재 등록된 일정이 없습니다.";

  // 4. 시스템 프롬프트
  const systemPrompt = buildSystemPrompt(userText, currentTimeString, timeContext, scheduleContextStr);

  // 5. 서버에 보낼 메시지 바디 조립 (시간 태그 부착)
  const mappedHistory = chatHistory.map(msg => {
    const timeTag = msg.timestamp ? `[${msg.timestamp}] ` : '';
    return { role: msg.role, content: `${timeTag}${msg.content}` };
  });

  const messagesBody = [systemPrompt, ...mappedHistory];

  try {
    // 6. AI 통신 (응답이 올 때까지 기다림)
    let aiResponse = await sendMessageToAI(messagesBody, appSettings.temperature);
    
    const aiTime = new Date().toLocaleString('ko-KR');
    chatHistory.push({ role: 'assistant', content: aiResponse, timestamp: aiTime });
    saveChatHistory();

    // ==========================================
    // 🤖 에이전트 1: 엑셀 생성기 가로채기
    // ==========================================
    const excelMatch = aiResponse.match(/<EXCEL>([\s\S]*?)<\/EXCEL>/i);
    if (excelMatch) {
      aiResponse = aiResponse.replace(excelMatch[0], '').trim();
      try {
        let cleanJsonText = excelMatch[1].trim()
          .replace(/^```json/i, '').replace(/```$/i, '').replace(/```/g, '').trim()
          .replace(/\s*\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (cleanJsonText.endsWith(',')) cleanJsonText = cleanJsonText.slice(0, -1).trim();
        if (cleanJsonText.startsWith('{') && !cleanJsonText.endsWith('}')) cleanJsonText += '\n}';
        
        await createExcelFromBlueprint(cleanJsonText);
        aiResponse += " 내 판단대로 데이터에 딱 맞는 수식과 디자인 레이아웃을 설계해서 바탕화면에 멋진 엑셀 파일로 피워냈어. 확인해 봐!";
      } catch (error) {
        console.error("🚨 엑셀 조립 실패:", error);
        aiResponse += " 앗, 데이터를 정교하게 조립하고 꾸미는 도중에 작은 시련이 찾아왔나 봐. 다시 한번 말해줄래?";
      }
    }

    // ==========================================
    // 🤖 에이전트 2: 일정 관리자 가로채기
    // ==========================================
    const scheduleMatch = aiResponse.match(/<SCHEDULE>([\s\S]*?)<\/SCHEDULE>/i);
    if (scheduleMatch) {
      aiResponse = aiResponse.replace(scheduleMatch[0], '').trim();
      try {
        let cleanJsonText = scheduleMatch[1].trim()
          .replace(/^```json/i, '').replace(/```$/i, '').replace(/```/g, '').trim()
          .replace(/\s*\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (cleanJsonText.endsWith(',')) cleanJsonText = cleanJsonText.slice(0, -1).trim();
        if (cleanJsonText.startsWith('{') && !cleanJsonText.endsWith('}')) cleanJsonText += '\n}';
        
        const scheduleData = JSON.parse(cleanJsonText);
        const action = scheduleData.action || "ADD"; 
        
        if (action === "ADD") {
          scheduleData.isNotified = false;
          addSchedule(scheduleData);
          aiResponse += ` 내 일정표에 완벽하게 추가해뒀어!`;
        } else if (action === "DELETE") {
          deleteSchedule(scheduleData.id);
          aiResponse += ` 요청한 일정을 일정표에서 깔끔하게 지웠어!`;
        } else if (action === "UPDATE") {
          scheduleData.isNotified = false; 
          updateSchedule(scheduleData.id, scheduleData);
          aiResponse += ` 일정 내용을 완벽하게 수정해뒀어!`;
        }
        
        if (renderSchedulesCallback) renderSchedulesCallback(); 
      } catch (error) {
        console.error("🚨 일정 조립 실패:", error);
        aiResponse += " 앗, 일정을 다이어리에 적다가 글씨가 엉켜버렸어. 시간과 내용을 다시 한번 말해줄래?";
      }
    }
    
    // 7. 처리 완료된 대사 발화
    speakElevenLabs(aiResponse);

  } catch (error) {
    console.error("AI 통신 실패:", error);
    chatHistory.pop(); 
    if (typeSubtitleCallback) typeSubtitleCallback(error.message);
  }
}

// 외부에서 쓸 수 있도록 함수 내보내기
module.exports = { processUserMessage };