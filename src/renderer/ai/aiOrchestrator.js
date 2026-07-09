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
    const showFileRenameCandidates = handlers?.showFileRenameCandidates;
    const showFileCreateCandidates = handlers?.showFileCreateCandidates;
    const showFileContentEditCandidates = handlers?.showFileContentEditCandidates;
    const showFileDeleteCandidates = handlers?.showFileDeleteCandidates;
    const showFileTransferCandidates = handlers?.showFileTransferCandidates;

    if (data.pending_file_transfer_candidates && typeof showFileTransferCandidates === 'function') {
      showFileTransferCandidates(data.pending_file_transfer_candidates);
    } else if (data.pending_file_delete_candidates && typeof showFileDeleteCandidates === 'function') {
      showFileDeleteCandidates(data.pending_file_delete_candidates);
    } else if (data.pending_file_content_edit_candidates && typeof showFileContentEditCandidates === 'function') {
      showFileContentEditCandidates(data.pending_file_content_edit_candidates);
    } else if (data.pending_file_create_candidates && typeof showFileCreateCandidates === 'function') {
      showFileCreateCandidates(data.pending_file_create_candidates);
    } else if (data.pending_file_rename_candidates && typeof showFileRenameCandidates === 'function') {
      showFileRenameCandidates(data.pending_file_rename_candidates);
    } else if (data.pending_file_open_candidates && typeof showFileOpenCandidates === 'function') {
      showFileOpenCandidates(data.pending_file_open_candidates);
    } else if (data.pending_file_open && typeof showFileOpenConfirmation === 'function') {
      showFileOpenConfirmation(data.pending_file_open);
    }

    if (typeSubtitle) {
      const hasPendingFileUi = data.pending_file_transfer_candidates
        || data.pending_file_delete_candidates
        || data.pending_file_content_edit_candidates
        || data.pending_file_create_candidates
        || data.pending_file_rename_candidates
        || data.pending_file_open_candidates
        || data.pending_file_open;
      const pendingFallback = data.pending_file_transfer_candidates
        ? '화면에 복사/이동 후보를 띄웠어. 원본과 위치를 선택해줘.'
        : (data.pending_file_delete_candidates
          ? '화면에 삭제 후보를 띄웠어. 원하는 항목을 선택해줘.'
          : (data.pending_file_content_edit_candidates
          ? '화면에 내용 수정 후보를 띄웠어. 원하는 파일을 선택해줘.'
          : (data.pending_file_create_candidates
            ? '화면에 생성 위치 후보를 띄웠어. 원하는 위치를 선택해줘.'
            : (data.pending_file_rename_candidates
              ? '화면에 이름 변경 후보를 띄웠어. 원하는 항목을 선택해줘.'
              : '화면에 후보를 띄웠어. 원하는 항목을 선택해줘.'))));
      const subtitleText = hasPendingFileUi ? sanitizeSpeechText(reply, pendingFallback) : reply;
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
