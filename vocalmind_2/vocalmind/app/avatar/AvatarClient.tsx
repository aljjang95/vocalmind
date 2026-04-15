'use client';

import { useEffect, useState } from 'react';
import { useAvatarStore } from '@/stores/avatarStore';
import AvatarEditor from '@/components/avatar/AvatarEditor';
import ItemShop from '@/components/avatar/ItemShop';
import styles from './AvatarClient.module.css';

type TabKey = 'my-avatar' | 'shop';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'my-avatar', label: '내 아바타' },
  { key: 'shop', label: '상점' },
];

export default function AvatarClient() {
  const { avatar, isGenerating, error, generateAvatar, fetchAvatar, clearError } =
    useAvatarStore();

  const [activeTab, setActiveTab] = useState<TabKey>('my-avatar');

  useEffect(() => {
    fetchAvatar();
  }, [fetchAvatar]);

  const handleGenerate = async () => {
    clearError();
    await generateAvatar(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>내 아바타</h1>
        {avatar && (
          <button
            className={styles.regenerateBtn}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? '생성 중...' : '아바타 재생성'}
          </button>
        )}
      </div>

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

      <div className={styles.content}>
        {activeTab === 'my-avatar' && (
          <>
            {avatar ? (
              <AvatarEditor />
            ) : (
              <div className={styles.noAvatar}>
                <span className={styles.noAvatarIcon}>&#127908;</span>
                <h2 className={styles.noAvatarTitle}>아바타가 없습니다</h2>
                <p className={styles.noAvatarDesc}>
                  나만의 보컬리스트 아바타를 생성하고, 의상과 액세서리로 꾸며보세요.
                </p>
                {error && <p className={styles.errorMsg}>{error}</p>}
                <button
                  className={styles.generateBtn}
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? '아바타 생성 중...' : '아바타 생성하기'}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'shop' && <ItemShop />}
      </div>
    </div>
  );
}
