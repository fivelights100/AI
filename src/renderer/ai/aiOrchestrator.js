const { appSettings, chatHistory, saveChatHistory } = require('../storage/configManager');
const { updateLipSync } = require('../companion/characterEngine');
const { playAudioWithLipSync } = require('../companion/audioPlayer');
const { sendChatMessage } = require('./aiClient');

function buildHistoryForServer() {
  return chatHistory
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function appendMessage(role, content) {
  chatHistory.push({
    role,
    content,
    timestamp: new Date().toLocaleString(),
  });
}

async function processUserMessage(userText, renderSchedules, typeSubtitle) {
  try {
    console.log('📨 Rust 서버로 메시지 전송 중...');

    const data = await sendChatMessage(userText, buildHistoryForServer());
    const reply = data.reply || '응답이 비어 있어.';

    appendMessage('user', userText);
    appendMessage('assistant', reply);
    saveChatHistory();

    if (typeSubtitle) typeSubtitle(reply);

    if (data.schedule_updated && renderSchedules) {
      await renderSchedules();
    }

    if (data.audio_base64) {
      await playAudioWithLipSync(data.audio_base64, updateLipSync, {
        lipSync: { sensitivity: appSettings.lipsyncSensitivity },
      });
    }
  } catch (error) {
    console.error('🚨 통신 에러:', error);

    if (typeSubtitle) {
      typeSubtitle('서버랑 연결이 조금 꼬였어. 서버가 켜져 있는지 확인해줘.');
    }
  }
}

module.exports = { processUserMessage };
