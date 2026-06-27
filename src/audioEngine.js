// src/audioEngine.js
const { appSettings } = require('./configManager');
require('dotenv').config();

// 🌟 [API 키 이동] 일레븐랩스 설정
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY; 
const VOICE_ID = "JTlYtJrcTzPC71hMLOxo";

// 🌟 [오디오 엔진 초기화]
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

const gainNode = audioCtx.createGain();
// 초기 볼륨은 설정 파일에서 가져옴
gainNode.gain.value = appSettings.volume !== undefined ? appSettings.volume : 1.0; 
analyser.connect(gainNode);
gainNode.connect(audioCtx.destination);

// 모듈 내부 상태 변수
let isMuted = false;
let live2dModelRef = null;
let subtitleCallback = null;

// 1. 엔진 구동 (renderer.js에서 Live2D 모델과 자막 함수를 넘겨받음)
function initAudioEngine(model, onSubtitle) {
  live2dModelRef = model;
  subtitleCallback = onSubtitle;
}

// 2. 음소거 및 볼륨 조절 제어기
function setMute(muteStatus) {
  isMuted = muteStatus;
  gainNode.gain.value = isMuted ? 0 : appSettings.volume;
}

function updateVolume(newVolume) {
  if (!isMuted) gainNode.gain.value = newVolume;
}

// 3. 립싱크 시뮬레이터 (내부 호출 전용)
function simulateLipSync() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  requestAnimationFrame(simulateLipSync);
  
  analyser.getByteFrequencyData(dataArray);
  let total = 0;
  for (let i = 0; i < bufferLength; i++) total += dataArray[i];
  const averageVolume = total / bufferLength; 
  
  // 설정 파일의 립싱크 민감도를 실시간으로 반영
  let mouthOpenValue = (averageVolume / 120) * appSettings.lipsyncSensitivity; 
  if (mouthOpenValue > 1.0) mouthOpenValue = 1.0;
  
  if (live2dModelRef && live2dModelRef.internalModel && live2dModelRef.internalModel.coreModel) {
    live2dModelRef.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouthOpenValue);
  }
}

// 4. 일레븐랩스 TTS 호출 및 재생
function speakElevenLabs(text) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("일레븐랩스 API 응답 오류");
    return res.arrayBuffer(); 
  })
  .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
  .then(audioBuffer => {
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser); 
    source.start(0);
    
    simulateLipSync();
    if (subtitleCallback) subtitleCallback(text); // 자막 출력 트리거
    
    source.onended = () => {
      if (live2dModelRef && live2dModelRef.internalModel && live2dModelRef.internalModel.coreModel) {
        live2dModelRef.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0);
      }
    };
  })
  .catch(err => {
    console.error("오디오 재생 실패:", err);
    if (subtitleCallback) subtitleCallback(text); 
  });
}

module.exports = {
  initAudioEngine,
  setMute,
  updateVolume,
  speakElevenLabs
};