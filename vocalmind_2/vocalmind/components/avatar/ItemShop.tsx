'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAvatarStore } from '@/stores/avatarStore';
import type { ShopItem, ItemCategory } from '@/types';
import ItemCard from './ItemCard';
import styles from './ItemShop.module.css';

type TabKey = 'all' | ItemCategory;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'hat', label: '모자' },
  { key: 'top', label: '상의' },
  { key: 'bottom', label: '하의' },
  { key: 'accessory', label: '액세서리' },
  { key: 'effect', label: '이펙트' },
  { key: 'crown', label: '왕관' },
];

export default function ItemShop() {
  const { shopItems, inventory, equipped, fetchShopItems, fetchInventory, fetchEquipped, equipItem } =
    useAvatarStore();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [pendingItem, setPendingItem] = useState<ShopItem | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    fetchShopItems();
    fetchInventory();
    fetchEquipped();
  }, [fetchShopItems, fetchInventory, fetchEquipped]);

  const ownedIds = useMemo(
    () => new Set(inventory.map((i) => i.item_id)),
    [inventory],
  );

  const equippedIds = useMemo(() => {
    if (!equipped) return new Set<string>();
    return new Set(
      [
        equipped.hat_id,
        equipped.top_id,
        equipped.bottom_id,
        equipped.accessory_id,
        equipped.effect_id,
      ].filter(Boolean) as string[],
    );
  }, [equipped]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return shopItems;
    return shopItems.filter((item) => item.category === activeTab);
  }, [shopItems, activeTab]);

  const handleBuy = (item: ShopItem) => {
    if (item.is_reward_only) return;
    if (ownedIds.has(item.id)) {
      // 이미 보유 중이면 바로 장착
      handleEquip(item);
      return;
    }
    if (item.price === 0) {
      // 무료 아이템 — 직접 인벤토리 추가 흐름 (별도 처리 필요, 여기서는 구매 모달 표시)
    }
    setPayError('');
    setPendingItem(item);
  };

  const handleEquip = async (item: ShopItem) => {
    await equipItem(item.category, item.id);
  };

  const handlePurchaseConfirm = async () => {
    if (!pendingItem) return;
    setIsPaying(true);
    setPayError('');

    // 무료 아이템은 토스 없이 직접 인벤토리 추가
    if (pendingItem.price === 0) {
      try {
        const res = await fetch('/api/shop/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: pendingItem.id,
            paymentKey: 'free',
            orderId: `free-${pendingItem.id}-${Date.now()}`,
            amount: 0,
          }),
        });
        if (res.ok) {
          await fetchInventory();
          setPendingItem(null);
        } else {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setPayError(body.error ?? '처리 실패');
        }
      } catch {
        setPayError('네트워크 오류가 발생했습니다.');
      } finally {
        setIsPaying(false);
      }
      return;
    }

    // 유료 아이템 — 토스 위젯으로 이동 (현재는 알림 표시)
    setPayError('결제 시스템 준비 중입니다. /checkout 페이지를 이용해주세요.');
    setIsPaying(false);
  };

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.grid}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {shopItems.length === 0 ? '상점 아이템을 불러오는 중...' : '해당 카테고리에 아이템이 없습니다.'}
          </p>
        ) : (
          filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isOwned={ownedIds.has(item.id)}
              isEquipped={equippedIds.has(item.id)}
              onBuy={handleBuy}
              onEquip={handleEquip}
            />
          ))
        )}
      </div>

      {/* 구매 확인 모달 */}
      {pendingItem && (
        <div className={styles.purchaseModal} onClick={() => setPendingItem(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{pendingItem.name}</h3>
            <p className={styles.modalDesc}>
              {pendingItem.is_season ? '시즌 한정 아이템입니다. ' : ''}
              이 아이템을 구매하시겠습니까?
            </p>
            <p className={styles.modalPrice}>
              {pendingItem.price === 0 ? '무료' : `${pendingItem.price.toLocaleString()}원`}
            </p>
            {payError && <p className={styles.errorMsg}>{payError}</p>}
            <div className={styles.modalBtns}>
              <button className={styles.btnCancel} onClick={() => setPendingItem(null)}>
                취소
              </button>
              <button
                className={styles.btnPay}
                onClick={handlePurchaseConfirm}
                disabled={isPaying}
              >
                {isPaying ? '처리 중...' : '구매하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
