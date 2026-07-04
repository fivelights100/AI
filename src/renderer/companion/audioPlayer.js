const { createLipSyncController } = require('./lipSync');

let audioContext = null;
const activeMasterGains = new Set();

async function playAudioWithLipSync(audioBase64, updateLipSync, options = {}) {
  if (!audioBase64) return;

  let lipSyncController = null;
  let masterGain = null;

  try {
    const context = getAudioContext();
    await resumeAudioContextIfNeeded(context);

    const audioBuffer = await decodeBase64Audio(context, audioBase64);
    const source = context.createBufferSource();
    const analyser = context.createAnalyser();

    masterGain = context.createGain();
    masterGain.gain.value = clamp01(options.volume ?? 1);
    activeMasterGains.add(masterGain);

    source.buffer = audioBuffer;
    source.connect(masterGain);
    masterGain.connect(context.destination);
    source.connect(analyser);

    lipSyncController = createLipSyncController(analyser, updateLipSync, options.lipSync);

    source.onended = () => {
      lipSyncController?.stop();
      activeMasterGains.delete(masterGain);
    };

    source.start();
    lipSyncController.start();
  } catch (error) {
    console.error('🚨 음성 재생 오류:', error);
    lipSyncController?.stop();
    if (masterGain) activeMasterGains.delete(masterGain);
    updateLipSync?.(0);
  }
}

function setActiveMasterVolume(volume) {
  const nextVolume = clamp01(volume);

  activeMasterGains.forEach((gainNode) => {
    gainNode.gain.value = nextVolume;
  });
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

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0, Math.min(1, number));
}

module.exports = { playAudioWithLipSync, setActiveMasterVolume };
