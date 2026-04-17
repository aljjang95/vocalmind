// ─────────────────────────────────────────────
// 아바타 타입 — 아바타, 의상 상점, 인벤토리, 보상
// ─────────────────────────────────────────────

// ── Phase 13: 아바타 + 의상 ──

export type ItemCategory = 'hat' | 'top' | 'bottom' | 'accessory' | 'effect' | 'crown';

export interface AvatarData {
  id: string;
  user_id: string;
  base_image_url: string;
  style_prompt: string | null;
  ref_image_url?: string | null;
  growth_level?: string | null;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  image_url: string;
  price: number;
  is_season: boolean;
  season_end_at: string | null;
  is_reward_only: boolean;
  created_at: string;
}

// InventoryItem alias
export type InventoryItem = UserInventoryItem;

export interface UserInventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  source: string;
  item?: ShopItem;
}

export interface UserEquipped {
  user_id: string;
  hat_id: string | null;
  top_id: string | null;
  bottom_id: string | null;
  accessory_id: string | null;
  effect_id: string | null;
  updated_at: string;
}

// ── Phase 13: 보상 ──

export type RewardType = 'crown' | 'effect' | 'title' | 'item';

export interface UserReward {
  id: string;
  user_id: string;
  reward_type: RewardType;
  reward_data: Record<string, unknown> | null;
  source: string;
  created_at: string;
}
