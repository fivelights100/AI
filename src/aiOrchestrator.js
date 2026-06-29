// src/aiOrchestrator.js
const { chatHistory, saveChatHistory } = require('./configManager');

const AI_SERVER_URL = 'http://localhost:3000/api/chat';

async function processUserMessage(userText, renderSchedules, typeSubtitle) {
  // 1. 내 메시지를 대화 기록에 추가
  chatHistory.push({ role: 'user', content: userText });
  saveChatHistory();

  try {
    // 2. 가벼워진 프론트엔드: Rust 서버로 대화 기록과 메시지만 전송
    const response = await fetch(AI_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // 문맥 유지를 위해 최근 6개의 기억(3번의 대화 왕복)만 서버로 전송
        history: chatHistory.slice(-6, -1), 
        message: userText
      })
    });

    if (!response.ok) throw new Error('서버 응답 오류');
    
    const data = await response.json();
    const aiReply = data.reply;
    
    // 3. 서버가 준 AI 답변을 기억에 저장하고 화면에 출력
    chatHistory.push({ role: 'assistant', content: aiReply });
    saveChatHistory();
    
    typeSubtitle(aiReply);

  } catch (error) {
    console.error("🚨 AI 클라우드 통신 실패:", error);
    typeSubtitle("서버와 연결이 끊긴 것 같아. 네트워크를 확인해 줄래?");
  }
}

module.exports = { processUserMessage };