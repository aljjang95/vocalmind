import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import type { AvatarData } from '@/types';

const PLACEHOLDER_URL = '/assets/avatar-items/placeholder-avatar.png';
const MAX_REF_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const RUNWARE_API_URL = 'https://api.runware.ai/v1';

function buildPrompt(voiceType: string | null): string {
  const basePrompt =
    'A charming K-pop style vocal singer character illustration, ' +
    'full body portrait, clean line art, flat color style, ' +
    'soft natural lighting, simple white background, ' +
    'professional music studio outfit, friendly expression, ' +
    'suitable for avatar customization layering, PNG transparent style.';

  const styleMap: Record<string, string> = {
    '저음': 'Deep warm tones, mature sophisticated look, dark navy or forest green outfit.',
    '중음': 'Balanced neutral tones, approachable look, casual smart outfit.',
    '고음': 'Bright light tones, youthful energetic look, pastel or white outfit.',
  };

  const styleHint = voiceType ? (styleMap[voiceType] ?? '') : '';
  return [basePrompt, styleHint].filter(Boolean).join(' ');
}

// GET: 현재 유저의 아바타 조회
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('avatars')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: '아바타 없음', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json(data as AvatarData);
}

// POST: AI 아바타 생성 (voiceType + 선택적 referenceImage)
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  // FormData 또는 JSON 모두 지원
  let voiceType: string | null = null;
  let referenceImageBuffer: ArrayBuffer | null = null;
  let referenceImageMime = 'image/jpeg';

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    if (formData) {
      voiceType = (formData.get('voiceType') as string | null) ?? null;
      const refFile = formData.get('referenceImage') as File | null;

      if (refFile) {
        // 크기 검증 (5MB)
        if (refFile.size > MAX_REF_IMAGE_BYTES) {
          return NextResponse.json(
            { error: '참고 이미지는 5MB 이하여야 합니다', code: 'FILE_TOO_LARGE' },
            { status: 400 },
          );
        }
        // 타입 검증
        if (!refFile.type.startsWith('image/')) {
          return NextResponse.json(
            { error: '이미지 파일만 업로드 가능합니다', code: 'INVALID_FILE_TYPE' },
            { status: 400 },
          );
        }
        referenceImageBuffer = await refFile.arrayBuffer();
        referenceImageMime = refFile.type;
      }
    }
  } else {
    const body = await req.json().catch(() => ({})) as { voiceType?: string | null };
    voiceType = body.voiceType ?? null;
  }

  // 참고 이미지가 있으면 Supabase Storage에 업로드
  let refImageStorageUrl: string | null = null;
  if (referenceImageBuffer) {
    const ext = referenceImageMime.split('/')[1] ?? 'jpg';
    const refPath = `${user.id}/ref_${Date.now()}.${ext}`;
    const { data: refUpload, error: refUploadErr } = await supabase.storage
      .from('avatars')
      .upload(refPath, referenceImageBuffer, {
        contentType: referenceImageMime,
        upsert: true,
      });

    if (!refUploadErr && refUpload) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(refPath);
      refImageStorageUrl = urlData.publicUrl;
    }
  }

  const prompt = buildPrompt(voiceType);

  let finalImageUrl = PLACEHOLDER_URL;

  const runwareKey = process.env.RUNWARE_API_KEY;
  if (runwareKey) {
    try {
      const taskUUID = crypto.randomUUID();

      // Runware FLUX 이미지 생성 (text-to-image / image-to-image)
      const taskBody: Record<string, unknown> = {
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: prompt,
        model: 'runware:100@1', // FLUX.1 Schnell — ~$0.0006/장 (FAILURES #3, 2026-04-18)
        width: 1024,
        height: 1024,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'PNG',
      };

      // 참고 이미지가 있으면 image-to-image
      if (referenceImageBuffer) {
        const base64 = Buffer.from(referenceImageBuffer).toString('base64');
        taskBody.seedImage = `data:${referenceImageMime};base64,${base64}`;
        taskBody.strength = 0.65;
      }

      const runwareRes = await fetch(RUNWARE_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${runwareKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([taskBody]),
      });

      if (runwareRes.ok) {
        const runwareData = await runwareRes.json() as {
          data?: Array<{ imageURL?: string }>;
        };

        const imageUrl = runwareData.data?.[0]?.imageURL;

        if (imageUrl) {
          // Runware URL 이미지를 Supabase Storage에 저장
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer();
            const fileName = `${user.id}/base.png`;
            const { data: uploadData } = await supabase.storage
              .from('avatars')
              .upload(fileName, buf, { contentType: 'image/png', upsert: true });
            if (uploadData) {
              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
              finalImageUrl = urlData.publicUrl;
            }
          }
        }
      }
    } catch {
      // Runware 실패 시 placeholder 사용
    }
  }

  // avatars 테이블 upsert
  const { data: avatarRow, error: dbError } = await supabase
    .from('avatars')
    .upsert(
      {
        user_id: user.id,
        base_image_url: finalImageUrl,
        style_prompt: prompt,
        ref_image_url: refImageStorageUrl,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (dbError || !avatarRow) {
    return NextResponse.json(
      { error: 'DB 저장 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json(avatarRow as AvatarData);
}
