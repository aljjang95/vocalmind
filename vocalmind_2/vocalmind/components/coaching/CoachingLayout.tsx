'use client';

import CurriculumTree from './CurriculumTree';
import CoachingChat from './CoachingChat';
import SessionInfo from './SessionInfo';
import DiagnosisBanner from './DiagnosisBanner';

export default function CoachingLayout() {
  return (
    <div className="flex flex-col gap-4">
      <DiagnosisBanner />
      <div className="grid grid-cols-[280px_1fr_260px] max-[960px]:grid-cols-[260px_1fr] max-[768px]:grid-cols-1 gap-4 items-start max-[960px]:[&>*:nth-child(3)]:col-span-full">
        <CurriculumTree />
        <CoachingChat />
        <SessionInfo />
      </div>
    </div>
  );
}
