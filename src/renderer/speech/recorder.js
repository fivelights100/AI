const DEFAULT_RECORDING_OPTIONS = {
  silenceDelayMs: 1500,
  minDecibels: -45,
  maxDurationMs: 10000,
  preferredMimeType: 'audio/webm',
};

async function recordUntilSilence(options = {}) {
  const settings = { ...DEFAULT_RECORDING_OPTIONS, ...options };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickSupportedMimeType(settings.preferredMimeType);

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    let stopSilenceDetection = null;
    let maxDurationTimer = null;
    let settled = false;

    const mediaRecorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );

    function cleanup() {
      if (maxDurationTimer) {
        clearTimeout(maxDurationTimer);
        maxDurationTimer = null;
      }

      if (stopSilenceDetection) {
        stopSilenceDetection();
        stopSilenceDetection = null;
      }

      stopStreamTracks(stream);
    }

    function safeResolve(blob) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    }

    function safeReject(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      safeReject(event.error || new Error('녹음 중 오류가 발생했습니다.'));
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, {
        type: mimeType || settings.preferredMimeType,
      });

      safeResolve(audioBlob);
    };

    try {
      mediaRecorder.start();

      stopSilenceDetection = detectSilence(stream, () => {
        stopMediaRecorder(mediaRecorder);
      }, settings);

      maxDurationTimer = setTimeout(() => {
        stopMediaRecorder(mediaRecorder);
      }, settings.maxDurationMs);
    } catch (error) {
      safeReject(error);
    }
  });
}

function detectSilence(stream, onSilence, options) {
  const audioContext = new window.AudioContext();
  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);

  microphone.connect(analyser);
  analyser.minDecibels = options.minDecibels;
  analyser.fftSize = 256;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let silenceStart = performance.now();
  let isSilent = true;
  let animationFrameId = null;
  let stopped = false;

  function stopDetector() {
    stopped = true;

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    audioContext.close().catch(() => {});
  }

  function check() {
    if (stopped) return;

    analyser.getByteFrequencyData(dataArray);

    if (hasAudioSignal(dataArray)) {
      silenceStart = performance.now();
      isSilent = false;
    } else if (!isSilent) {
      silenceStart = performance.now();
      isSilent = true;
    } else if (performance.now() - silenceStart > options.silenceDelayMs) {
      onSilence();
      return;
    }

    animationFrameId = requestAnimationFrame(check);
  }

  check();

  return stopDetector;
}

function hasAudioSignal(dataArray) {
  return dataArray.some((value) => value > 0);
}

function stopMediaRecorder(mediaRecorder) {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
  }
}

function stopStreamTracks(stream) {
  stream.getTracks().forEach((track) => track.stop());
}

function pickSupportedMimeType(preferredMimeType) {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    preferredMimeType,
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ].filter(Boolean);

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

module.exports = {
  DEFAULT_RECORDING_OPTIONS,
  recordUntilSilence,
};
