/**
 * BeatGrid 로더 — Supabase Storage에서 곡별 비트 격자 JSON을 가져오고 LRU 캐시한다.
 *
 * 캐시는 메모리 한정(최대 20개). 같은 곡 재요청 시 네트워크 호출을 생략한다.
 */
import type { BeatGrid } from '@/types';

const CACHE_MAX = 20;
const cache = new Map<string, BeatGrid>();

function touch(key: string, value: BeatGrid): void {
  // LRU: 기존 항목 제거 후 끝에 다시 삽입 (Map은 삽입 순서 보존)
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

/**
 * 캐시 또는 네트워크에서 BeatGrid를 로드한다.
 *
 * @param url Supabase Storage 공개 URL (song-beats/{songId}.json)
 * @returns 성공 시 BeatGrid, 실패/없음이면 null (피치 모드로 폴백)
 */
export async function loadBeatGrid(url: string): Promise<BeatGrid | null> {
  const cached = cache.get(url);
  if (cached) {
    touch(url, cached);
    return cached;
  }

  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;

    const raw = await res.json();
    const grid = parseBeatGrid(raw);
    if (!grid) return null;

    touch(url, grid);
    return grid;
  } catch {
    return null;
  }
}

function parseBeatGrid(raw: unknown): BeatGrid | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bpm = typeof r.bpm === 'number' ? r.bpm : null;
  const offset = typeof r.firstBeatOffsetSec === 'number' ? r.firstBeatOffsetSec : null;
  const beats = Array.isArray(r.beatTimes) ? r.beatTimes.filter((n): n is number => typeof n === 'number') : null;
  const source = ['manual', 'ai', 'none'].includes(String(r.source))
    ? (r.source as BeatGrid['source'])
    : 'none';

  if (bpm === null || offset === null || !beats || beats.length === 0) return null;

  return { bpm, firstBeatOffsetSec: offset, beatTimes: beats, source };
}

/** 테스트 / 디버깅용 캐시 초기화 */
export function clearBeatGridCache(): void {
  cache.clear();
}

/** 테스트 / 디버깅용 캐시 크기 조회 */
export function beatGridCacheSize(): number {
  return cache.size;
}
