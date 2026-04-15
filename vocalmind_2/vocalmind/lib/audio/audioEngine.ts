/**
 * AudioContext singleton and gain-node tree.
 *
 * Signal path:
 *   accompanimentGain ──┐
 *                       ├─► compressor ──► masterGain ──► destination
 *   micGain ────────────┘
 *   metronomeGain ──────────────────────► masterGain ──► destination
 *
 * All getters use lazy initialization and are safe to call from SSR
 * (they will throw only if actually invoked on the server, which
 * should never happen for audio code).
 */

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let accompanimentGain: GainNode | null = null;
let micGain: GainNode | null = null;
let metronomeGain: GainNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;

function assertBrowser(): void {
  if (typeof window === 'undefined') {
    throw new Error('AudioEngine must not be used during SSR.');
  }
}

export function getAudioContext(): AudioContext {
  assertBrowser();
  if (!audioContext) {
    audioContext = new AudioContext({ latencyHint: 'interactive' });
  }
  return audioContext;
}

export function getMasterGain(): GainNode {
  if (!masterGain) {
    const ctx = getAudioContext();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

export function getCompressorNode(): DynamicsCompressorNode {
  if (!compressorNode) {
    const ctx = getAudioContext();
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-24, ctx.currentTime);
    compressorNode.knee.setValueAtTime(30, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(12, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.25, ctx.currentTime);
    compressorNode.connect(getMasterGain());
  }
  return compressorNode;
}

export function getAccompanimentGain(): GainNode {
  if (!accompanimentGain) {
    const ctx = getAudioContext();
    accompanimentGain = ctx.createGain();
    accompanimentGain.connect(getCompressorNode());
  }
  return accompanimentGain;
}

export function getMicGain(): GainNode {
  if (!micGain) {
    const ctx = getAudioContext();
    micGain = ctx.createGain();
    micGain.connect(getCompressorNode());
  }
  return micGain;
}

export function getMetronomeGain(): GainNode {
  if (!metronomeGain) {
    const ctx = getAudioContext();
    metronomeGain = ctx.createGain();
    metronomeGain.connect(getMasterGain());
  }
  return metronomeGain;
}

export function setMasterVolume(volume: number): void {
  const gain = getMasterGain();
  gain.gain.setValueAtTime(
    Math.max(0, Math.min(1, volume)),
    getAudioContext().currentTime,
  );
}

export function setAccompanimentVolume(volume: number): void {
  const gain = getAccompanimentGain();
  gain.gain.setValueAtTime(
    Math.max(0, Math.min(1, volume)),
    getAudioContext().currentTime,
  );
}

export function setMicVolume(volume: number): void {
  const gain = getMicGain();
  gain.gain.setValueAtTime(
    Math.max(0, Math.min(1, volume)),
    getAudioContext().currentTime,
  );
}

export function setMetronomeVolume(volume: number): void {
  const gain = getMetronomeGain();
  gain.gain.setValueAtTime(
    Math.max(0, Math.min(1, volume)),
    getAudioContext().currentTime,
  );
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

/**
 * Insert a pitch-shifter node between a source node and a destination (gain) node.
 *
 * Signal path after insertion:
 *   sourceNode ──► shiftNode ──► destinationNode
 *
 * If shiftNode is null, connects source directly to destination (bypass).
 * This function does NOT disconnect sourceNode from any previous connections;
 * the caller is responsible for managing disconnection.
 */
export function connectWithPitchShifter(
  sourceNode: AudioNode,
  shiftNode: AudioNode | null,
  destinationNode: AudioNode,
): void {
  if (shiftNode) {
    sourceNode.connect(shiftNode);
    shiftNode.connect(destinationNode);
  } else {
    sourceNode.connect(destinationNode);
  }
}

export function disposeAudioEngine(): void {
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
    masterGain = null;
    accompanimentGain = null;
    micGain = null;
    metronomeGain = null;
    compressorNode = null;
  }
}
