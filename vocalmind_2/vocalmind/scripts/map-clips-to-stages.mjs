/**
 * ChromaDB 피드백 → Supabase 오디오 클립 → 28단계 매핑
 *
 * 실행: cd vocalmind && node scripts/map-clips-to-stages.mjs
 * 출력: lib/data/stageDemoAudio.ts (28단계별 demoAudioUrl 매핑)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env.local 파싱
const envText = readFileSync(join(ROOT, '.env.local'), 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const BUCKET = 'vocal-clips';
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;

// YouTube 12편 video_id 목록
const VIDEO_IDS = [
  '-5D8f1_90A4', '-aSYpMUjkCc', '2AhK6LFo4wo', '4z8trJ0v8Qc',
  '5pKOqEk7DB4', '8BiPkJplixA', 'gQqQVqAeMQw', 'klkXYLy4sY0',
  'PnmSVKj5YjI', 'qZw20taAp18', 'rPppnN0mC-Q', 'y_vAEBJ3V0Y',
];

// stage_feedback_map.json 로드
const stageMap = JSON.parse(
  readFileSync(join(ROOT, 'backend/data/stage_feedback_map.json'), 'utf-8')
);

async function main() {
  // 1. 모든 클립 목록 수집 + 파싱
  console.log('1. Supabase vocal-clips 스캔...');
  const allClips = {}; // { videoId: [{name, startSec, endSec, url}] }

  for (const vid of VIDEO_IDS) {
    const { data: files, error } = await sb.storage.from(BUCKET).list(vid, { limit: 200 });
    if (error || !files) {
      console.warn(`  ${vid}: 에러 ${error?.message}`);
      continue;
    }

    allClips[vid] = files
      .filter(f => f.name.endsWith('.wav'))
      .map(f => {
        // clip_000_108s_120s.wav → start=108, end=120
        const m = f.name.match(/clip_\d+_(\d+)s_(\d+)s\.wav/);
        if (!m) return null;
        const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(`${vid}/${f.name}`);
        return {
          name: f.name,
          startSec: parseInt(m[1]),
          endSec: parseInt(m[2]),
          url: urlData.publicUrl,
          duration: parseInt(m[2]) - parseInt(m[1]),
        };
      })
      .filter(Boolean);

    console.log(`  ${vid}: ${allClips[vid].length} clips`);
  }

  // 2. 각 단계별 YouTube 피드백 → 타임스탬프 매칭 → 최적 클립 선택
  console.log('\n2. 28단계별 클립 매핑...');
  const stageAudio = {}; // { stageId: { url, videoId, clipName } }

  for (let stageId = 1; stageId <= 28; stageId++) {
    const stageData = stageMap[String(stageId)];
    if (!stageData) continue;

    const feedbackIds = stageData.feedback_ids || [];

    // YouTube 피드백만 필터 (fb_{videoId}_{number} 패턴)
    const ytFeedbacks = feedbackIds.filter(id => {
      const parts = id.replace(/^fb_/, '');
      return VIDEO_IDS.some(vid => parts.startsWith(vid + '_'));
    });

    if (ytFeedbacks.length === 0) {
      console.log(`  Stage ${stageId} (${stageData.stage_name}): YouTube 피드백 없음`);
      continue;
    }

    // 피드백 ID에서 video_id와 대략적 순서 추출
    // fb_{videoId}_{index} 형식
    let bestClip = null;
    let bestScore = -1;

    for (const fbId of ytFeedbacks) {
      const stripped = fbId.replace(/^fb_/, '');
      for (const vid of VIDEO_IDS) {
        if (!stripped.startsWith(vid + '_')) continue;

        const clips = allClips[vid];
        if (!clips || clips.length === 0) continue;

        // 이 비디오의 클립 중 10~30초 길이인 것을 선호 (시범에 적합)
        for (const clip of clips) {
          let score = 0;
          // 적정 길이 선호 (10~30초)
          if (clip.duration >= 10 && clip.duration <= 30) score += 10;
          else if (clip.duration >= 5 && clip.duration <= 45) score += 5;
          // 너무 짧거나 길면 감점
          if (clip.duration < 5) score -= 10;
          if (clip.duration > 60) score -= 5;

          if (score > bestScore) {
            bestScore = score;
            bestClip = { url: clip.url, videoId: vid, clipName: clip.name, duration: clip.duration };
          }
        }
        break; // 첫 매칭 비디오에서 선택
      }
      if (bestClip) break; // 첫 매칭 피드백에서 선택
    }

    if (bestClip) {
      stageAudio[stageId] = bestClip;
      console.log(`  Stage ${stageId} (${stageData.stage_name}): ${bestClip.clipName} (${bestClip.duration}s)`);
    } else {
      console.log(`  Stage ${stageId} (${stageData.stage_name}): 적합한 클립 없음`);
    }
  }

  // 3. 매핑이 안 된 단계에 라운드로빈으로 클립 배정
  console.log('\n3. 미배정 단계 보충...');
  const allClipsList = Object.values(allClips).flat()
    .filter(c => c.duration >= 8 && c.duration <= 40)
    .sort((a, b) => b.duration - a.duration);

  let clipIdx = 0;
  for (let stageId = 1; stageId <= 28; stageId++) {
    if (stageAudio[stageId]) continue;
    if (clipIdx < allClipsList.length) {
      const clip = allClipsList[clipIdx++];
      const vid = VIDEO_IDS.find(v => clip.url.includes(v)) || '';
      stageAudio[stageId] = { url: clip.url, videoId: vid, clipName: clip.name, duration: clip.duration };
      console.log(`  Stage ${stageId}: 보충 ${clip.name} (${clip.duration}s)`);
    }
  }

  // 4. TypeScript 파일 생성
  console.log('\n4. stageDemoAudio.ts 생성...');
  const entries = Object.entries(stageAudio)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([id, clip]) => `  ${id}: '${clip.url}',`)
    .join('\n');

  const tsContent = `/**
 * 28단계별 시범 오디오 URL (Supabase vocal-clips 버킷)
 * 자동 생성: node scripts/map-clips-to-stages.mjs
 */
export const stageDemoAudioUrl: Record<number, string> = {
${entries}
};
`;

  const outPath = join(ROOT, 'lib/data/stageDemoAudio.ts');
  writeFileSync(outPath, tsContent, 'utf-8');
  console.log(`\n저장: ${outPath}`);
  console.log(`매핑 완료: ${Object.keys(stageAudio).length}/28 단계`);
}

main().catch(console.error);
