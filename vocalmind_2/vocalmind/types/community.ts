// ─────────────────────────────────────────────
// 커뮤니티 타입 — 게시글, 투표, 피드 탭
// ─────────────────────────────────────────────

// ── Phase 13: 커뮤니티 ──

export type PostType = 'cover' | 'battle' | 'free';
export type FeedTab = 'latest' | 'popular' | 'battle';

// Vote alias
export type Vote = CommunityVote;

export interface CommunityPost {
  id: string;
  user_id: string;
  type: PostType;
  title: string | null;
  description: string | null;
  audio_url: string | null;
  song_title: string | null;
  song_artist: string | null;
  vote_count: number;
  play_count: number;
  is_deleted: boolean;
  created_at: string;
  // joined fields
  author_name?: string;
  author_avatar_url?: string;
  has_voted?: boolean;
}

export interface CommunityVote {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}
