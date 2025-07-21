// src/utils/pitchDetection.ts
export class PitchDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private scriptProcessor: ScriptProcessorNode;
  private mediaStreamSource?: MediaStreamAudioSourceNode;
  private onPitchDetected: (pitch: number) => void;
  private sampleRate: number;
  private buffer: Float32Array;
  private autoCorrelateBuffer: Float32Array;

  constructor(
    audioContext: AudioContext | OfflineAudioContext,
    onPitchDetected: (pitch: number) => void
  ) {
    this.audioContext = audioContext as AudioContext;
    this.onPitchDetected = onPitchDetected;
    this.sampleRate = audioContext.sampleRate;

    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.autoCorrelateBuffer = new Float32Array(this.analyser.fftSize);

    this.scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
    this.scriptProcessor.onaudioprocess = this.processAudio.bind(this);
  }

  connect(source: MediaStreamAudioSourceNode) {
    this.mediaStreamSource = source;
    this.mediaStreamSource.connect(this.analyser);
    this.analyser.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  disconnect() {
    if (this.mediaStreamSource) {
      this.analyser.disconnect();
      this.scriptProcessor.disconnect();
      this.mediaStreamSource.disconnect();
    }
  }

  private processAudio() {
    this.analyser.getFloatTimeDomainData(this.buffer);
    const pitch = this.autoCorrelate(this.buffer);
    if (pitch !== -1) {
      this.onPitchDetected(pitch);
    }
  }

  private autoCorrelate(buffer: Float32Array): number {
    const nSamples = buffer.length;

    // Find RMS and skip if too quiet
    let rms = 0;
    for (let i = 0; i < nSamples; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / nSamples);
    if (rms < 0.01) return -1;

    // Trim silence from beginning
    let threshold = 0.2;
    let i = 0;
    while (i < nSamples && Math.abs(buffer[i]) < threshold) i++;
    if (i === nSamples) return -1;

    // Auto-correlation
    let bestOffset = -1;
    let bestCorrelation = 0;
    const correlationBuffer = this.autoCorrelateBuffer;

    for (let offset = 40; offset < nSamples / 2; offset++) {
      let correlation = 0;

      for (let j = 0; j < nSamples - offset; j++) {
        correlation += Math.abs(buffer[j] - buffer[j + offset]);
      }

      correlation = 1 - correlation / (nSamples - offset);
      correlationBuffer[offset] = correlation;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (bestCorrelation < 0.1) return -1;

    // Quadratic interpolation for better accuracy
    const shift =
      correlationBuffer[bestOffset + 1] - correlationBuffer[bestOffset - 1];
    const fractionalOffset =
      shift /
      (2 *
        (2 * correlationBuffer[bestOffset] -
          correlationBuffer[bestOffset - 1] -
          correlationBuffer[bestOffset + 1]));

    const finalOffset = bestOffset + fractionalOffset;
    return this.sampleRate / finalOffset;
  }
}
