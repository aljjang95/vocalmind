'use client';

import { CURRICULUM } from '@/lib/curriculum';
import { useCoachingStore } from '@/stores/coachingStore';

export default function CurriculumTree() {
  const {
    currentCategoryId,
    currentLessonId,
    completedLessons,
    setCurrentCategory,
    setCurrentLesson,
    clearMessages,
  } = useCoachingStore();

  const handleLessonClick = (categoryId: string, lessonId: string) => {
    setCurrentCategory(categoryId);
    setCurrentLesson(lessonId);
    clearMessages();
  };

  return (
    <aside className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between px-[18px] pt-[18px] pb-3.5 border-b border-[var(--border)]">
        <h3 className="font-['Inter',sans-serif] text-[0.95rem] font-bold">커리큘럼</h3>
        <span className="font-mono text-[0.72rem] text-[var(--success-lt)] bg-[rgba(34,197,94,0.1)] px-2.5 py-[3px] rounded-[10px]">
          {completedLessons.length}/{CURRICULUM.reduce((a, c) => a + c.lessons.length, 0)} 완료
        </span>
      </div>
      <nav className="overflow-y-auto flex-1 py-2 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--border2)] [&::-webkit-scrollbar-thumb]:rounded-sm">
        {CURRICULUM.map((cat) => {
          const isExpanded = cat.id === currentCategoryId;
          const catCompleted = cat.lessons.filter((l) => completedLessons.includes(l.id)).length;

          return (
            <div key={cat.id} className="border-b border-[var(--border)] last:border-b-0">
              <button
                type="button"
                className={`w-full flex items-center gap-2.5 px-4 py-3 bg-transparent border-none text-[0.82rem] font-['Inter','Noto_Sans_KR',sans-serif] cursor-pointer text-left transition-colors duration-150 ${
                  isExpanded
                    ? 'bg-[var(--surface)] text-[var(--text)]'
                    : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                }`}
                onClick={() => setCurrentCategory(isExpanded ? '' : cat.id)}
              >
                <span className="text-base shrink-0">{cat.icon}</span>
                <span className="flex-1 font-medium">{cat.title}</span>
                <span className="font-mono text-[0.68rem] text-[var(--muted)]">{catCompleted}/{cat.lessons.length}</span>
              </button>
              {isExpanded && (
                <ul className="list-none p-0 pb-1.5">
                  {cat.lessons.map((lesson) => {
                    const isActive = lesson.id === currentLessonId;
                    const isDone = completedLessons.includes(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          className={`w-full flex items-center gap-2 px-4 pl-10 py-2 bg-transparent border-none text-[0.78rem] font-['Inter','Noto_Sans_KR',sans-serif] cursor-pointer text-left transition-all duration-150 ${
                            isActive
                              ? 'bg-[rgba(59,130,246,0.08)] text-[var(--accent)]'
                              : isDone
                              ? 'text-[var(--success-lt)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                              : 'text-[var(--text2)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                          }`}
                          onClick={() => handleLessonClick(cat.id, lesson.id)}
                        >
                          <span
                            className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center text-[0.56rem] shrink-0 ${
                              isActive
                                ? 'border-[var(--accent)] bg-[rgba(59,130,246,0.2)]'
                                : isDone
                                ? 'border-[var(--success)] bg-[rgba(34,197,94,0.2)] text-[var(--success-lt)]'
                                : 'border-[var(--border2)]'
                            }`}
                          >
                            {isDone ? '&#10003;' : ''}
                          </span>
                          <span className="flex-1">{lesson.title}</span>
                          <span className="font-mono text-[0.64rem] text-[var(--muted)] opacity-70">{lesson.durationMin}분</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
