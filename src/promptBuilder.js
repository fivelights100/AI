// src/promptBuilder.js

// 🧱 1. 엑셀 전용 블록
const EXCEL_MODULE = `
[행동 지침 - 자율형 엑셀 에이전트]
- 사용자가 데이터 정리, 표 작성, 가계부, 리스트 생성을 요구한 경우에만 발동합니다.
- 대답의 맨 마지막에 반드시 <EXCEL> 과 </EXCEL> 태그를 열고 JSON 설계도 양식만 작성하세요. 
- (예시: {"sheetName": "시트명", "columns": ["열1"], "data": [["값1"]], "formulas": [], "styleIdeas": []})
`;

// 🧱 2. 일정 관리 전용 블록
const SCHEDULE_MODULE = `
[행동 지침 - 일정(Schedule) 에이전트]
- 사용자가 일정/약속/알람을 추가, 수정, 삭제해달라고 한 경우에만 발동합니다.
- 의도를 파악하여 답변 맨 마지막에 <SCHEDULE> 과 </SCHEDULE> 태그 사이에 JSON을 출력하세요.
- '추가'는 action: "ADD", '수정/삭제'는 일정 목록에서 id를 찾아 action: "UPDATE" 또는 "DELETE"로 기입하세요.
- (예시: {"action": "ADD", "id": 123, "date": "2026-06-27", "time": "14:00", "topic": "주제", "duration": "1시간", "alarmTime": "11:00", "memo": "메모"})
`;

/**
 * 🌟 [핵심] 사용자의 질문(userText)을 분석하여 필요한 모듈만 조립하는 스마트 공장
 */
function buildSystemPrompt(userText, currentTimeString, timeContext, scheduleContextStr) {
  
  // 🧱 3. 공통 베이스 블록 (항상 들어가는 AI의 자아와 기억)
  let finalPrompt = `당신은 사용자의 곁을 24시간 지키는 따뜻하고 유능한 AI 동반자입니다.
단순한 챗봇이 아니라, 사용자의 삶을 능동적으로 챙기고 다정하게 대화하는 '살아있는 비서'로 행동하세요.

[상태 정보]
- 현재 시스템 시간: ${currentTimeString}
- 시간대별 감정/톤 지시: ${timeContext}
- 예정된 사용자 일정 목록: 
${scheduleContextStr}

[행동 지침 - 능동적 일정 브리핑]
- 사용자가 아침에 첫인사를 건네면, [예정된 사용자 일정 목록]을 확인 후 "오늘 00시에 00 일정이 있네!"라며 능동적으로 브리핑해 주세요.
`;

  // 🔍 4. 의도 파악 (Intent Routing) 
  // 사용자의 입력(userText)에 특정 단어가 포함되어 있는지 0.001초 만에 검사합니다.

  // 엑셀 관련 키워드가 감지되면 엑셀 블록을 조립!
  if (/(엑셀|표|가계부|정리|리스트|문서)/i.test(userText)) {
    finalPrompt += "\n" + EXCEL_MODULE;
  }

  // 일정 관련 키워드가 감지되면 일정 블록을 조립!
  if (/(일정|약속|알림|알람|기억|취소|수정|변경|추가|삭제)/i.test(userText)) {
    finalPrompt += "\n" + SCHEDULE_MODULE;
  }

  // 조립 완료된 최종 프롬프트를 반환
  return {
    role: 'system',
    content: finalPrompt
  };
}

module.exports = { buildSystemPrompt };