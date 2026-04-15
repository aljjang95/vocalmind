/**
 * Metronome click tone generator.
 * Downbeat: 1000 Hz, Upbeat: 800 Hz.
 */

import { getAudioContext } from '@/lib/audio/audioEngine';

const CLICK_DURATION = 0.01; // 10ms burst
const DOWNBEAT_FREQ = 1000;
const UPBEAT_FREQ = 800;

/**
 * Schedule a single metronome click.
 *
 * @param destination - The AudioNode to route the click into.
 * @param time        - The AudioContext time at which the click should play.
 * @param isDownbeat  - If true, plays a louder, higher-pitched click.
 */
export function playClick(
  destination: AudioNode,
  time: number,
  isDownbeat: boolean,
): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const clickGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(
    isDownbeat ? DOWNBEAT_FREQ : UPBEAT_FREQ,
    time,
  );

  clickGain.gain.setValueAtTime(0, time);
  clickGain.gain.linearRampToValueAtTime(
    isDownbeat ? 0.8 : 0.5,
    time + 0.001,
  );
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION);

  osc.connect(clickGain);
  clickGain.connect(destination);

  osc.start(time);
  osc.stop(time + CLICK_DURATION + 0.01);
}
