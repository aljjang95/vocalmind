import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.VOCAL_BACKEND_URL || 'http://localhost:8001';

function createSilentWav(durationSec = 0.45, sampleRate = 16000): ArrayBuffer {
  const samples = Math.floor(durationSec * sampleRate);
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return buffer;
}

function fallbackAudioResponse() {
  return new NextResponse(createSilentWav(), {
    headers: {
      'Content-Type': 'audio/wav',
      'X-TTS-Fallback': 'silent',
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { text?: string; voice?: string };

  if (!body.text?.trim()) {
    return NextResponse.json(
      { error: '텍스트가 필요합니다', code: 'NO_TEXT' },
      { status: 400 }
    );
  }

  const voice = body.voice === 'master' ? 'master' : 'default';

  try {
    const res = await fetch(`${BACKEND}/onboarding/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body.text, voice }),
    });

    if (!res.ok) {
      return fallbackAudioResponse();
    }

    const contentType = res.headers.get('Content-Type') || 'audio/mpeg';
    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return fallbackAudioResponse();
  }
}
