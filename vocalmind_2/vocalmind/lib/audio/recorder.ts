/**
 * MediaRecorder wrapper for Play mode recording.
 * Records user vocal input as webm/opus for later scoring.
 */

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recording = false;

/**
 * Start recording from the given MediaStream.
 * If already recording, this is a no-op.
 */
export function startRecording(stream: MediaStream): void {
  if (typeof window === 'undefined') return;
  if (recording) return;

  recordedChunks = [];

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start(100); // collect data every 100ms
  recording = true;
}

/**
 * Stop the current recording and return the recorded audio as a Blob.
 * Resolves with a webm/opus Blob.
 * Rejects if not currently recording.
 */
export function stopRecording(): Promise<Blob> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('stopRecording must not be called during SSR.'));
  }

  if (!recording || !mediaRecorder) {
    return Promise.reject(new Error('Not currently recording.'));
  }

  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('MediaRecorder is null.'));
      return;
    }

    mediaRecorder.onstop = () => {
      if (recordedChunks.length === 0) {
        reject(new Error('No audio data recorded.'));
        return;
      }

      const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType ?? 'audio/webm' });
      recordedChunks = [];
      mediaRecorder = null;
      recording = false;
      resolve(blob);
    };

    mediaRecorder.onerror = () => {
      recordedChunks = [];
      mediaRecorder = null;
      recording = false;
      reject(new Error('Recording failed.'));
    };

    mediaRecorder.stop();
  });
}

/** Check whether recording is currently in progress. */
export function isRecording(): boolean {
  return recording;
}
