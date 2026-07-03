const DEFAULT_WAKE_WORD_OPTIONS = {
  wakeWordIndex: 1,
  wakeThreshold: 0.97,
  probabilityThreshold: 0.95,
  overlapFactor: 0.5,
};

async function createWakeWordRecognizer(modelUrl) {
  if (typeof speechCommands === 'undefined') {
    throw new Error('TensorFlow Speech Commands가 로드되지 않았습니다.');
  }

  const normalizedModelUrl = ensureTrailingSlash(modelUrl);
  const recognizer = speechCommands.create(
    'BROWSER_FFT',
    undefined,
    `${normalizedModelUrl}model.json`,
    `${normalizedModelUrl}metadata.json`,
  );

  await recognizer.ensureModelLoaded();

  return {
    recognizer,
    labels: recognizer.wordLabels(),
  };
}

function startWakeWordListening(recognizer, onDetected, options = {}) {
  const mergedOptions = { ...DEFAULT_WAKE_WORD_OPTIONS, ...options };

  if (!recognizer) {
    throw new Error('호출어 recognizer가 초기화되지 않았습니다.');
  }

  recognizer.listen((result) => {
    const wakeScore = getWakeWordScore(result, mergedOptions.wakeWordIndex);

    if (wakeScore >= mergedOptions.wakeThreshold) {
      onDetected({ score: wakeScore, result });
    }
  }, {
    includeSpectrogram: false,
    probabilityThreshold: mergedOptions.probabilityThreshold,
    invokeCallbackOnNoiseAndUnknown: false,
    overlapFactor: mergedOptions.overlapFactor,
  });
}

function stopWakeWordListening(recognizer) {
  if (!recognizer) return;

  try {
    recognizer.stopListening();
  } catch (error) {
    console.warn('호출어 감지 중지 실패:', error);
  }
}

function getWakeWordScore(result, wakeWordIndex) {
  if (!result?.scores || result.scores.length <= wakeWordIndex) {
    return 0;
  }

  return Number(result.scores[wakeWordIndex]) || 0;
}

function ensureTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '') + '/';
}

module.exports = {
  DEFAULT_WAKE_WORD_OPTIONS,
  createWakeWordRecognizer,
  startWakeWordListening,
  stopWakeWordListening,
};
