const {
  createWakeWordRecognizer,
  startWakeWordListening,
  stopWakeWordListening,
} = require('./wakeWord');
const { recordUntilSilence } = require('./recorder');
const { transcribeAudioBlob } = require('./sttClient');

let recognizer = null;
let isHandlingCommand = false;

async function initWakeWordListener(modelUrl, onWake, onTranscribed) {
  try {
    const setup = await createWakeWordRecognizer(modelUrl);
    recognizer = setup.recognizer;

    console.log(`👂 로컬 AI 호출어 가동 완료! (인식 대상: ${setup.labels.join(', ')})`);
    listenForWakeWord(onWake, onTranscribed);
  } catch (error) {
    console.error('호출어 감지 초기화 오류:', error);
  }
}

function listenForWakeWord(onWake, onTranscribed) {
  startWakeWordListening(recognizer, ({ score }) => {
    if (isHandlingCommand) return;

    console.log('확실한 호출어 감지! 점수:', score);
    isHandlingCommand = true;
    stopWakeWordListening(recognizer);
    onWake();

    setTimeout(() => {
      handleVoiceCommand(onTranscribed).finally(() => {
        isHandlingCommand = false;
        listenForWakeWord(onWake, onTranscribed);
      });
    }, 400);
  });
}

async function handleVoiceCommand(onTranscribed) {
  try {
    const audioBlob = await recordUntilSilence();

    if (!audioBlob || audioBlob.size === 0) {
      onTranscribed(null);
      return;
    }

    const text = await transcribeAudioBlob(audioBlob);
    onTranscribed(text);
  } catch (error) {
    console.error('음성 명령 처리 오류:', error);
    onTranscribed(null);
  }
}

module.exports = {
  initWakeWordListener,
};
