const { createLipSyncController } = require('./lipSync');

let audioContext = null;

async function playAudioWithLipSync(audioBase64, updateLipSync, options = {}) {
  if (!audioBase64) return;

  let lipSyncController = null;

  try {
    const context = getAudioContext();
    await resumeAudioContextIfNeeded(context);

    const audioBuffer = await decodeBase64Audio(context, audioBase64);
    const source = context.createBufferSource();
    const analyser = context.createAnalyser();

    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.connect(analyser);

    lipSyncController = createLipSyncController(analyser, updateLipSync, options.lipSync);

    source.onended = () => {
      lipSyncController?.stop();
    };

    source.start();
    lipSyncController.start();
  } catch (error) {
    console.error('🚨 음성 재생 오류:', error);
    lipSyncController?.stop();
    updateLipSync?.(0);
  }
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function resumeAudioContextIfNeeded(context) {
  if (context.state === 'suspended') {
    await context.resume();
  }
}

async function decodeBase64Audio(context, audioBase64) {
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return context.decodeAudioData(bytes.buffer);
}

module.exports = { playAudioWithLipSync };
