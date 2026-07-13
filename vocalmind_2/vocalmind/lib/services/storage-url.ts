import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function toStoragePath(bucket: string, value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/')) return value;

  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const publicIndex = value.indexOf(publicMarker);
  if (publicIndex >= 0) {
    return decodeURIComponent(value.slice(publicIndex + publicMarker.length).split('?')[0]);
  }

  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  const signedIndex = value.indexOf(signedMarker);
  if (signedIndex >= 0) {
    return decodeURIComponent(value.slice(signedIndex + signedMarker.length).split('?')[0]);
  }

  return value;
}

export async function createSignedStorageUrl(
  supabase: SupabaseClient,
  bucket: string,
  value: string | null | undefined,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const path = toStoragePath(bucket, value);
  if (!path) return null;
  if (path.startsWith('/')) return path;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function createAdminSignedStorageUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  return createSignedStorageUrl(createAdminClient(), bucket, value, expiresIn);
}

export function buildInternalAudioUrl(kind: 'community' | 'audition', id: string): string {
  return kind === 'community' ? `/api/community/audio/${id}` : `/api/audition/audio/${id}`;
}
