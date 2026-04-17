'use client';

import { useBreathingStore } from '@/stores/breathingStore';
import LongBreathTimer from './LongBreathTimer';
import RhythmBreathTimer from './RhythmBreathTimer';
import PhraseBreathTimer from './PhraseBreathTimer';

export default function BreathTimer() {
  const mode = useBreathingStore((s) => s.mode);
  const isActive = useBreathingStore((s) => s.isActive);
  const setActive = useBreathingStore((s) => s.setActive);
  const updateExhaleDuration = useBreathingStore((s) => s.updateExhaleDuration);
  const setBreathData = useBreathingStore((s) => s.setBreathData);
  const saveRecord = useBreathingStore((s) => s.saveRecord);
  const resetSession = useBreathingStore((s) => s.resetSession);

  switch (mode) {
    case 'long':
      return (
        <LongBreathTimer
          isActive={isActive}
          setActive={setActive}
          updateExhaleDuration={updateExhaleDuration}
          setBreathData={setBreathData}
          saveRecord={saveRecord}
          resetSession={resetSession}
        />
      );
    case 'rhythm':
      return (
        <RhythmBreathTimer
          isActive={isActive}
          setActive={setActive}
          setBreathData={setBreathData}
          resetSession={resetSession}
        />
      );
    case 'phrase':
      return (
        <PhraseBreathTimer
          isActive={isActive}
          setActive={setActive}
          updateExhaleDuration={updateExhaleDuration}
          setBreathData={setBreathData}
          saveRecord={saveRecord}
          resetSession={resetSession}
        />
      );
  }
}
