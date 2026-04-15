import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AvatarData } from '@/types';

const PLACEHOLDER_URL = '/assets/avatar-items/placeholder-avatar.png';
const MAX_REF_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function buildPrompt(voiceType: string | null, hasRefImage: boolean): string {
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
  const refHint = hasRefImage
    ? 'Reference the facial features and personal style of the provided reference image, reimagined as a K-pop illustration character.'
    : '';

  return [basePrompt, styleHint, refHint].filter(Boolean).join(' ');
}

// GET: 현재 유저의 아바타 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

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
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

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

  const hasRefImage = referenceImageBuffer !== null;
  const prompt = buildPrompt(voiceType, hasRefImage);

  let finalImageUrl = PLACEHOLDER_URL;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      let openaiRes: Response;

      if (referenceImageBuffer) {
        // edit 엔드포인트: 참고 이미지 기반 생성
        const editForm = new FormData();
        const blob = new Blob([referenceImageBuffer], { type: referenceImageMime });
        editForm.append('image', blob, `ref.${referenceImageMime.split('/')[1] ?? 'jpg'}`);
        editForm.append('prompt', prompt);
        editForm.append('model', 'gpt-image-1');
        editForm.append('size', '1024x1024');
        editForm.append('quality', 'low');
        editForm.append('n', '1');

        openaiRes = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: editForm,
        });
      } else {
        // generations 엔드포인트: 텍스트 프롬프트만
        openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt,
            quality: 'low',
            size: '1024x1024',
            n: 1,
          }),
        });
      }

      if (openaiRes.ok) {
        const openaiData = await openaiRes.json() as {
          data?: Array<{ url?: string; b64_json?: string }>;
        };

        const imageEntry = openaiData.data?.[0];

        const saveToStorage = async (buf: ArrayBuffer): Promise<string | null> => {
          const fileName = `${user.id}/base.png`;
          const { data: uploadData } = await supabase.storage
            .from('avatars')
            .upload(fileName, buf, { contentType: 'image/png', upsert: true });
          if (!uploadData) return null;
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          return urlData.publicUrl;
        };

        if (imageEntry?.url) {
          const imgRes = await fetch(imageEntry.url);
          if (imgRes.ok) {
            const saved = await saveToStorage(await imgRes.arrayBuffer());
            if (saved) finalImageUrl = saved;
          }
        } else if (imageEntry?.b64_json) {
          const binaryStr = atob(imageEntry.b64_json);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const saved = await saveToStorage(bytes.buffer);
          if (saved) finalImageUrl = saved;
        }
      }
    } catch {
      // OpenAI 실패 시 placeholder 사용
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
