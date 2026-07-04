function createLipSyncController(analyser, onVolume, options = {}) {
  const divisor = Number(options.divisor || 80);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let animationFrameId = null;
  let stopped = false;

  function tick() {
    if (stopped) return;

    analyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const sensitivity = resolveSensitivity(options);
    const normalizedVolume = Math.min(1, (average / divisor) * sensitivity);

    onVolume(normalizedVolume);
    animationFrameId = requestAnimationFrame(tick);
  }

  return {
    start() {
      stopped = false;
      tick();
    },
    stop() {
      stopped = true;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      onVolume(0);
    },
  };
}

function resolveSensitivity(options) {
  const value = typeof options.getSensitivity === 'function'
    ? options.getSensitivity()
    : options.sensitivity;
  const number = Number(value ?? 0.5);

  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0.1, Math.min(1, number));
}

module.exports = { createLipSyncController };
