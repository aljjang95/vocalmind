/**
 * Pre-rendered WhyText audio is disabled until the public bucket DNS/asset
 * health check is restored. The lesson UI falls back to live TTS instead of
 * trying broken URLs and showing a network error to learners.
 */
export const stageWhyAudioUrl: Record<number, string> = {};
