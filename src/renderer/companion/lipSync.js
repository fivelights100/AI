function createLipSyncController(analyser, onVolume, options = {}) {
  const sensitivity = Number(options.sensitivity || 1);
  const divisor = Number(options.divisor || 80);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let animationFrameId = null;
  let stopped = false;

  function tick() {
    if (stopped) return;

    analyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
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

module.exports = { createLipSyncController };
