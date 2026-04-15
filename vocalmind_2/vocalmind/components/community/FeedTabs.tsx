'use client';

import { useRef, useEffect, useState } from 'react';
import type { FeedTab } from '@/types';
import styles from './FeedTabs.module.css';

interface Tab {
  id: FeedTab;
  label: string;
}

const TABS: Tab[] = [
  { id: 'latest', label: '최신' },
  { id: 'popular', label: '인기' },
  { id: 'battle', label: '배틀' },
];

interface FeedTabsProps {
  activeTab: FeedTab;
  onChange: (tab: FeedTab) => void;
}

export default function FeedTabs({ activeTab, onChange }: FeedTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    if (!activeEl) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    setIndicatorStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    });
  }, [activeTab]);

  return (
    <div className={styles.tabsWrapper}>
      <div ref={containerRef} className={styles.tabsContainer} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-tab={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div
          className={styles.indicator}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      </div>
    </div>
  );
}
