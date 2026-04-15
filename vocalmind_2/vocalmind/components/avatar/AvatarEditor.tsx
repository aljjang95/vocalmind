'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAvatarStore } from '@/stores/avatarStore';
import type { ShopItem, ItemCategory } from '@/types';
import AvatarDisplay, { type ResolvedLayers } from './AvatarDisplay';
import ItemCard from './ItemCard';
import AvatarGrowthBadge from './AvatarGrowthBadge';
import styles from './AvatarEditor.module.css';
import photoStyles from './AvatarPhotoUpload.module.css';

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

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  hat: '모자',
  top: '상의',
  bottom: '하의',
  accessory: '액세서리',
  effect: '이펙트',
  crown: '왕관',
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export default function AvatarEditor() {
  const { avatar, equipped, inventory, fetchAvatar, fetchInventory, fetchEquipped, equipItem } =
    useAvatarStore();

  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // 사진 업로드 상태
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [refPhoto, setRefPhoto] = useState<File | null>(null);
  const [refPhotoPreview, setRefPhotoPreview] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [generatingWithPhoto, setGeneratingWithPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAvatar();
    fetchInventory();
    fetchEquipped();
  }, [fetchAvatar, fetchInventory, fetchEquipped]);

  // 인벤토리 아이템만 표시
  const inventoryItems = useMemo(
    () => inventory.map((inv) => inv.item).filter(Boolean) as ShopItem[],
    [inventory],
  );

  const filtered = useMemo(() => {
    if (activeTab === 'all') return inventoryItems;
    return inventoryItems.filter((item) => item.category === activeTab);
  }, [inventoryItems, activeTab]);

  // item_id → ShopItem 룩업 맵
  const itemMap = useMemo(() => {
    const map = new Map<string, ShopItem>();
    inventoryItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [inventoryItems]);

  // 장착된 아이템 ID 세트
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

  // 레이어 해결: equipped ID → 이미지 URL
  const resolvedLayers = useMemo((): ResolvedLayers => {
    if (!equipped) return {};
    const lookup = (id: string | null) => (id ? (itemMap.get(id)?.image_url ?? null) : null);
    return {
      bottomUrl: lookup(equipped.bottom_id),
      topUrl: lookup(equipped.top_id),
      hatUrl: lookup(equipped.hat_id),
      accessoryUrl: lookup(equipped.accessory_id),
      effectUrl: lookup(equipped.effect_id),
    };
  }, [equipped, itemMap]);

  // 장착된 아이템 이름 표시용
  const equippedNames = useMemo(() => {
    if (!equipped) return {} as Record<ItemCategory, string | null>;
    const lookup = (id: string | null) => (id ? (itemMap.get(id)?.name ?? null) : null);
    return {
      hat: lookup(equipped.hat_id),
      top: lookup(equipped.top_id),
      bottom: lookup(equipped.bottom_id),
      accessory: lookup(equipped.accessory_id),
      effect: lookup(equipped.effect_id),
      crown: null,
    } as Record<ItemCategory, string | null>;
  }, [equipped, itemMap]);

  const handleEquip = async (item: ShopItem) => {
    const isEquipped = equippedIds.has(item.id);
    await equipItem(item.category, isEquipped ? null : item.id);
  };

  const handleUnequip = async (category: ItemCategory) => {
    await equipItem(category, null);
  };

  const categories: ItemCategory[] = ['hat', 'top', 'bottom', 'accessory', 'effect'];

  // 사진 업로드 처리
  const handlePhotoSelect = useCallback((file: File) => {
    setPhotoError(null);
    if (!file.type.startsWith('image/')) {
      setPhotoError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }
    setRefPhoto(file);
    const url = URL.createObjectURL(file);
    setRefPhotoPreview(url);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handlePhotoSelect(file);
    },
    [handlePhotoSelect],
  );

  const handleGenerateWithPhoto = useCallback(async () => {
    if (!refPhoto || !agreedToTerms) return;
    setGeneratingWithPhoto(true);
    setPhotoError(null);
    try {
      const formData = new FormData();
      formData.append('referenceImage', refPhoto);
      const res = await fetch('/api/avatar/generate', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '서버 오류' }));
        throw new Error(err.error ?? '아바타 생성 실패');
      }
      await fetchAvatar();
      setShowPhotoUpload(false);
      setRefPhoto(null);
      if (refPhotoPreview) {
        URL.revokeObjectURL(refPhotoPreview);
        setRefPhotoPreview(null);
      }
      setAgreedToTerms(false);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '아바타 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingWithPhoto(false);
    }
  }, [refPhoto, agreedToTerms, fetchAvatar, refPhotoPreview]);

  const handleCancelPhoto = useCallback(() => {
    setShowPhotoUpload(false);
    setRefPhoto(null);
    if (refPhotoPreview) {
      URL.revokeObjectURL(refPhotoPreview);
      setRefPhotoPreview(null);
    }
    setAgreedToTerms(false);
    setPhotoError(null);
  }, [refPhotoPreview]);

  return (
    <div className={styles.wrap}>
      {/* 좌측: 아바타 프리뷰 + 장착 정보 */}
      <div className={styles.previewCol}>
        {/* 아바타 + 성장 뱃지 */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <AvatarDisplay
            avatar={avatar}
            equipped={equipped}
            resolvedLayers={resolvedLayers}
            size="lg"
          />
          <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
            <AvatarGrowthBadge totalRecordingSec={0} avatarLevel={avatar?.growth_level ?? undefined} />
          </div>
        </div>

        {/* 아바타 생성 버튼 영역 */}
        <div className={styles.equippedInfo}>
          {!showPhotoUpload ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                className={photoStyles.generateBtn}
                onClick={() => {
                  const form = new FormData();
                  fetch('/api/avatar/generate', { method: 'POST', body: form })
                    .then(() => fetchAvatar())
                    .catch(() => {});
                }}
              >
                아바타 생성
              </button>
              <button
                type="button"
                className={photoStyles.photoBtn}
                onClick={() => setShowPhotoUpload(true)}
              >
                사진 참고로 만들기
              </button>
            </div>
          ) : (
            /* 사진 업로드 UI */
            <div className={photoStyles.photoUploadWrap}>
              <p className={photoStyles.photoUploadTitle}>사진으로 아바타 만들기</p>
              <p className={photoStyles.photoUploadDesc}>
                업로드한 사진의 스타일을 참고하여 아바타를 생성합니다.
              </p>

              {/* 파일 선택 영역 */}
              <div
                className={photoStyles.dropArea}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="사진 선택"
              >
                {refPhotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={refPhotoPreview}
                    alt="참고 이미지 미리보기"
                    className={photoStyles.preview}
                  />
                ) : (
                  <div className={photoStyles.dropPlaceholder}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={photoStyles.uploadIcon}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span className={photoStyles.dropText}>클릭하여 사진 선택</span>
                    <span className={photoStyles.dropHint}>JPG, PNG, WEBP · 최대 5MB</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />

              {/* 약관 동의 */}
              <label className={photoStyles.termsLabel}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className={photoStyles.termsCheck}
                />
                <span className={photoStyles.termsText}>
                  업로드하는 이미지의 초상권 및 저작권은 본인에게 있음을 확인합니다.
                </span>
              </label>

              {photoError && (
                <p className={photoStyles.errorMsg}>{photoError}</p>
              )}

              <div className={photoStyles.actionRow}>
                <button
                  type="button"
                  className={photoStyles.cancelBtn}
                  onClick={handleCancelPhoto}
                  disabled={generatingWithPhoto}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={photoStyles.confirmBtn}
                  onClick={handleGenerateWithPhoto}
                  disabled={!refPhoto || !agreedToTerms || generatingWithPhoto}
                >
                  {generatingWithPhoto ? '생성 중...' : '이 사진 스타일로 생성'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 장착 정보 */}
        {!showPhotoUpload && (
          <div className={styles.equippedInfo}>
            <p className={styles.equippedTitle}>장착 중</p>
            {categories.map((cat) => (
              <div key={cat} className={styles.equippedRow}>
                <span className={styles.equippedLabel}>{CATEGORY_LABEL[cat]}</span>
                {equippedNames[cat] ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.equippedValue}>{equippedNames[cat]}</span>
                    <button
                      className={styles.unequipBtn}
                      onClick={() => handleUnequip(cat)}
                      title="장착 해제"
                      aria-label={`${CATEGORY_LABEL[cat]} 장착 해제`}
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className={styles.equippedNone}>없음</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 우측: 인벤토리 그리드 */}
      <div className={styles.inventoryCol}>
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
            <div className={styles.emptyInventory}>
              <p>인벤토리에 아이템이 없습니다.</p>
              <p className={styles.emptyInventoryHint}>상점에서 아이템을 구매해보세요!</p>
            </div>
          ) : (
            filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isOwned={true}
                isEquipped={equippedIds.has(item.id)}
                onBuy={() => {}}
                onEquip={handleEquip}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
