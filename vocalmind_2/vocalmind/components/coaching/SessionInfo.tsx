'use client';

import { useCoachingStore } from '@/stores/coachingStore';
import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { getLessonById, CURRICULUM } from '@/lib/curriculum';

export default function SessionInfo() {
  const { currentLessonId, completedLessons } = useCoachingStore();
  const { result } = useDiagnosisStore();

  const lessonInfo = getLessonById(currentLessonId);
  const totalLessons = CURRICULUM.reduce((a, c) => a + c.lessons.length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  return (
    <aside className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] p-5 flex flex-col gap-6 max-h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--border2)] [&::-webkit-scrollbar-thumb]:rounded-sm">
      <div className="flex flex-col gap-2.5">
        <h4 className="text-[0.78rem] font-semibold text-[var(--text2)] uppercase tracking-wider">현재 레슨</h4>
        {lessonInfo ? (
          <>
            <div className="flex items-center gap-3 px-3.5 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)]">
              <span className="text-[1.3rem] shrink-0">{lessonInfo.category.icon}</span>
              <div>
                <div className="text-[0.85rem] font-semibold text-[var(--text)]">{lessonInfo.lesson.title}</div>
                <div className="font-mono text-[0.68rem] text-[var(--text2)]">{lessonInfo.lesson.durationMin}분 소요</div>
              </div>
            </div>
            <p className="text-[0.8rem] text-[var(--text2)] leading-relaxed">{lessonInfo.lesson.description}</p>
          </>
        ) : (
          <p className="text-[0.82rem] text-[var(--text2)]">레슨을 선택해주세요</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className="text-[0.78rem] font-semibold text-[var(--text2)] uppercase tracking-wider">전체 진행률</h4>
        <div className="h-1.5 bg-[var(--surface2)] rounded-[3px] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--success)] to-[var(--success-lt)] rounded-[3px] transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-[0.72rem] text-[var(--text2)]">
          <span>{completedLessons.length}/{totalLessons} 레슨 완료</span>
          <span className="font-mono text-[var(--success-lt)]">{progressPct}%</span>
        </div>
      </div>

      {result && (
        <div className="flex flex-col gap-2.5">
          <h4 className="text-[0.78rem] font-semibold text-[var(--text2)] uppercase tracking-wider">진단 결과 요약</h4>
          <div className="flex gap-4 p-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)]">
            <div className="flex flex-col items-center justify-center min-w-[52px]">
              <span className="font-mono text-[1.4rem] font-bold text-[var(--accent)] leading-none">{result.overallScore}</span>
              <span className="text-[0.58rem] text-[var(--text2)] mt-1">종합 점수</span>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              {result.strengths.slice(0, 2).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[0.75rem] text-[var(--text2)]">
                  <span className="w-[5px] h-[5px] rounded-full shrink-0 bg-[var(--teal)]" />
                  {s}
                </div>
              ))}
              {result.weaknesses.slice(0, 1).map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-[0.75rem] text-[var(--text2)]">
                  <span className="w-[5px] h-[5px] rounded-full shrink-0 bg-[var(--rose)]" />
                  {w}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
