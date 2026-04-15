'use client';

import { useEffect, useState, useCallback } from 'react';

interface FeedbackRequest {
  id: string;
  user_id: string;
  audio_path: string | null;
  concern: string;
  status: 'pending' | 'completed' | 'reviewed';
  teacher_comment: string | null;
  created_at: string;
  profiles: { email: string; full_name: string | null } | null;
}

type StatusFilter = 'all' | 'pending' | 'completed';

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-600',
  reviewed: 'bg-blue-500/15 text-blue-500',
  completed: 'bg-green-500/15 text-green-700',
};

export default function TeacherClient() {
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/teacher/requests' : `/api/teacher/requests?status=${filter}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { requests: FeedbackRequest[] };
      setRequests(data.requests);
      const initComments: Record<string, string> = {};
      data.requests.forEach((r) => {
        initComments[r.id] = r.teacher_comment ?? '';
      });
      setComments(initComments);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const getAudioUrl = useCallback(async (req: FeedbackRequest) => {
    if (audioUrls[req.id] || !req.audio_path) return;
    const res = await fetch(`/api/storage-url?path=${encodeURIComponent(req.audio_path)}`);
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setAudioUrls((prev) => ({ ...prev, [req.id]: url }));
    }
  }, [audioUrls]);

  const saveComment = async (id: string, newStatus?: string) => {
    setSaving((prev) => ({ ...prev, [id]: true }));
    await fetch(`/api/teacher/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_comment: comments[id] ?? '',
        ...(newStatus ? { status: newStatus } : {}),
      }),
    });
    setSaving((prev) => ({ ...prev, [id]: false }));
    void loadRequests();
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="bg-[var(--bg-card)] border-b border-[var(--border)] px-8 py-6">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] m-0">선생님 대시보드</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">유료 피드백 신청 관리</p>
          </div>
          {pendingCount > 0 && (
            <span className="bg-[var(--accent)] text-white text-[0.8rem] font-semibold px-3 py-1 rounded-full">
              {pendingCount}개 대기중
            </span>
          )}
        </div>
      </header>

      <main className="max-w-[900px] mx-auto p-8">
        <div className="flex gap-2 mb-6">
          {(['pending', 'all', 'completed'] as StatusFilter[]).map((filterVal) => (
            <button
              key={filterVal}
              className={`px-5 py-2 rounded-lg border text-sm cursor-pointer transition-all ${
                filter === filterVal
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
              onClick={() => setFilter(filterVal)}
            >
              {filterVal === 'pending' ? '대기중' : filterVal === 'all' ? '전체' : '완료'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-[var(--text-muted)] py-16 text-[0.95rem]">불러오는 중...</div>
        ) : requests.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-16 text-[0.95rem]">
            {filter === 'pending' ? '대기중인 신청이 없습니다.' : '신청 내역이 없습니다.'}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {requests.map((req) => (
              <div key={req.id} className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 ${req.status === 'completed' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold text-[var(--text-primary)]">
                      {req.profiles?.full_name ?? req.profiles?.email ?? req.user_id.slice(0, 8)}
                    </span>
                    <span className="text-[0.8rem] text-[var(--text-muted)]">{req.profiles?.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[req.status] ?? ''}`}>
                      {req.status === 'pending' ? '대기' : req.status === 'reviewed' ? '검토중' : '완료'}
                    </span>
                    <span className="text-[0.8rem] text-[var(--text-muted)]">
                      {new Date(req.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">고민/요청</p>
                  <p className="text-[0.95rem] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap m-0">{req.concern}</p>
                </div>

                {req.audio_path && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">녹음 파일</p>
                    {audioUrls[req.id] ? (
                      <audio controls className="w-full h-9" src={audioUrls[req.id]} />
                    ) : (
                      <button
                        className="px-4 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-secondary)] text-sm cursor-pointer hover:bg-[var(--border)]"
                        onClick={() => void getAudioUrl(req)}
                      >
                        녹음 듣기
                      </button>
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">코멘트 작성</p>
                  <textarea
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-[0.9rem] p-3 resize-y font-[inherit] leading-relaxed focus:outline-none focus:border-[var(--accent)]"
                    placeholder="피드백 코멘트를 입력하세요..."
                    value={comments[req.id] ?? ''}
                    onChange={(e) => setComments((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    className="px-5 py-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-primary)] text-sm cursor-pointer hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => void saveComment(req.id)}
                    disabled={saving[req.id]}
                  >
                    {saving[req.id] ? '저장 중...' : '코멘트 저장'}
                  </button>
                  {req.status !== 'completed' && (
                    <button
                      className="px-5 py-2 rounded-lg border-none bg-[var(--accent)] text-white text-sm font-semibold cursor-pointer hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      onClick={() => void saveComment(req.id, 'completed')}
                      disabled={saving[req.id]}
                    >
                      완료 처리
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
