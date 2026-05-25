/**
 * public/video-editor/workers/audio-processor.js
 * 
 * Background Audio Processing worker.
 * Downsamples heavy audio channels into lightweight amplitude peak arrays.
 * Moves intensive array parsing entirely off the main thread.
 */

self.onmessage = async (e) => {
  const { type, channelData, samplesCount } = e.data;

  if (type === 'GENERATE_WAVEFORM') {
    try {
      const floatArray = new Float32Array(channelData);
      const peaks = downsampleAudio(floatArray, samplesCount);
      
      // Transfer results back to main thread using transferable buffers
      self.postMessage({
        type: 'WAVEFORM_COMPLETE',
        peaks: peaks.buffer
      }, [peaks.buffer]);
      
    } catch (err) {
      self.postMessage({ type: 'WAVEFORM_ERROR', message: err.message });
    }
  }
};

/**
 * Downsamples raw float audio channel data into a tiny array of peaks (max/min amplitudes).
 */
function downsampleAudio(data, samples) {
  const blockSize = Math.floor(data.length / samples);
  const peaks = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let max = 0;
    
    // Process block and find absolute peak amplitude
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(data[start + j]);
      if (val > max) max = val;
    }
    
    peaks[i] = max;
  }

  return peaks;
}
