const { appSettings, chatHistory, saveChatHistory } = require('../storage/configManager');
const { updateLipSync } = require('../companion/characterEngine');
const { playAudioWithLipSync } = require('../companion/audioPlayer');
const { sendChatMessage } = require('./aiClient');
const { sanitizeSpeechText } = require('../speech/speechSanitizer');

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

async function processUserMessage(userText, handlers, typeSubtitle) {
  try {
    console.log('📨 Rust 서버로 메시지 전송 중...');

    const data = await sendChatMessage(userText, buildHistoryForServer());
    const reply = data.reply || '응답이 비어 있어.';

    appendMessage('user', userText);
    appendMessage('assistant', reply);
    saveChatHistory();

    const renderSchedules = typeof handlers === 'function' ? handlers : handlers?.renderSchedules;
    const renderLedgerEntries = handlers?.renderLedgerEntries;
    const showFileOpenConfirmation = handlers?.showFileOpenConfirmation;
    const showFileOpenCandidates = handlers?.showFileOpenCandidates;

    if (data.pending_file_open_candidates && typeof showFileOpenCandidates === 'function') {
      showFileOpenCandidates(data.pending_file_open_candidates);
    } else if (data.pending_file_open && typeof showFileOpenConfirmation === 'function') {
      showFileOpenConfirmation(data.pending_file_open);
    }

    if (typeSubtitle) {
      const subtitleText = data.pending_file_open_candidates || data.pending_file_open
        ? sanitizeSpeechText(reply, '화면에 후보를 띄웠어. 원하는 항목을 선택해줘.')
        : reply;
      typeSubtitle(subtitleText);
    }

    if (data.schedule_updated && renderSchedules) {
      await renderSchedules();
    }

    if (data.ledger_updated && renderLedgerEntries) {
      await renderLedgerEntries();
    }

    if (data.audio_base64) {
      await playAudioWithLipSync(data.audio_base64, updateLipSync, {
        volume: appSettings.volume,
        lipSync: { getSensitivity: () => appSettings.lipSyncSensitivity },
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
