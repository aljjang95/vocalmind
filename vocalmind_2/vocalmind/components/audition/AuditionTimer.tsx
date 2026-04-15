'use client';

import { useState, useEffect } from 'react';
import styles from './AuditionTimer.module.css';

interface AuditionTimerProps {
  weekEnd: string; // ISO date string
  compact?: boolean; // 대시보드 위젯용 축소 모드
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isUrgent: boolean; // 24시간 이내
}

function calcTimeLeft(weekEnd: string): TimeLeft {
  const diff = Math.max(0, new Date(weekEnd).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = diff <= 24 * 60 * 60 * 1000;
  return { days, hours, minutes, seconds, isUrgent };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function AuditionTimer({ weekEnd, compact }: AuditionTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(weekEnd));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calcTimeLeft(weekEnd));
    }, 1000);

    return () => clearInterval(timer);
  }, [weekEnd]);

  const urgentClass = timeLeft.isUrgent ? styles.urgent : '';
  const isExpired = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isExpired) {
    return (
      <div className={`${styles.timer} ${styles.urgent} ${compact ? styles.compact : ''}`} aria-label="마감됨">
        <span className={styles.digits}>마감</span>
      </div>
    );
  }

  return (
    <div className={`${styles.timer} ${urgentClass} ${compact ? styles.compact : ''}`} aria-label="마감까지 남은 시간">
      {timeLeft.days > 0 && (
        <>
          <span className={styles.digits}>{timeLeft.days}</span>
          <span className={styles.unit}>일</span>
          <span className={styles.sep}> </span>
        </>
      )}
      <span className={styles.digits}>{pad(timeLeft.hours)}</span>
      <span className={styles.sep}>:</span>
      <span className={styles.digits}>{pad(timeLeft.minutes)}</span>
      <span className={styles.sep}>:</span>
      <span className={styles.digits}>{pad(timeLeft.seconds)}</span>
    </div>
  );
}
