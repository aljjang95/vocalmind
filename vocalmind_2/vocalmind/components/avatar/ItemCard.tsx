'use client';

import Image from 'next/image';
import type { ShopItem } from '@/types';
import styles from './ItemCard.module.css';

const CATEGORY_ICON: Record<string, string> = {
  hat: '🎩',
  top: '👗',
  bottom: '👖',
  accessory: '💎',
  effect: '✨',
  crown: '👑',
};

interface Props {
  item: ShopItem;
  isOwned: boolean;
  isEquipped: boolean;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
}

export default function ItemCard({ item, isOwned, isEquipped, onBuy, onEquip }: Props) {
  const cardClass = [
    styles.card,
    isEquipped ? styles.equipped : isOwned ? styles.owned : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (item.is_reward_only) return;
    if (isOwned) {
      onEquip(item);
    } else {
      onBuy(item);
    }
  };

  const categoryIcon = CATEGORY_ICON[item.category] ?? '🏷️';

  return (
    <div
      className={cardClass}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      aria-label={item.name}
    >
      <div className={styles.imageWrap}>
        {item.image_url && !item.image_url.includes('placeholder') ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className={styles.itemImage}
            unoptimized
          />
        ) : (
          <span className={styles.placeholderImg}>{categoryIcon}</span>
        )}

        {item.is_season && !item.is_reward_only && (
          <span className={styles.seasonBadge}>한정</span>
        )}
        {item.is_reward_only && (
          <span className={styles.rewardBadge}>보상</span>
        )}

        {isEquipped && (
          <div className={styles.equippedOverlay}>
            <span className={styles.checkIcon}>✓</span>
          </div>
        )}
      </div>

      <div className={styles.info}>
        <p className={styles.name}>{item.name}</p>
        <div className={styles.priceRow}>
          {item.is_reward_only ? (
            <span className={styles.rewardOnly}>보상 전용</span>
          ) : (
            <>
              <span className={styles.price}>
                {item.price === 0 ? '무료' : `${item.price.toLocaleString()}원`}
              </span>
              {isOwned ? (
                <span className={styles.ownedLabel}>보유</span>
              ) : (
                <button
                  className={styles.buyBtn}
                  onClick={(e) => { e.stopPropagation(); onBuy(item); }}
                >
                  구매
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
