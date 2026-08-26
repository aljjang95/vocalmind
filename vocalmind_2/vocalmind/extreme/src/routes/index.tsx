import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { curriculum, stageById } from '#/curriculum'
import { productContract } from '#/product'

export const Route = createFileRoute('/')({ component: VocalmindRuntime })

type SessionUser = { id: string; email: string; name: string }
type LearnerProfile = {
  id: string
  email: string
  name: string | null
  role: string
  has_onboarding_result: number
}
type LearnerProgress = {
  id: string
  stage_id: number
  best_score: number
  attempts: number
  passed: boolean
  updated_at: string | null
}
type LearnerEvaluation = {
  id: string
  stage_id: number
  score: number | null
  pitch_accuracy: number | null
  tone_stability: number | null
  tension_detected: boolean
  feedback: string
  passed: boolean
  created_at: string | null
}
type LearnerDashboard = {
  profile: LearnerProfile | null
  progress: LearnerProgress[]
  evaluations: LearnerEvaluation[]
  summary: {
    totalStages: number
    completedStages: number
    totalAttempts: number
    nextStage: number
  }
}
type ScreenState = 'checking' | 'signed-out' | 'loading-dashboard' | 'ready' | 'error'
type AuthMode = 'sign-in' | 'sign-up'

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: 'include', ...init })
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null
  if (!response.ok) {
    throw new Error(body?.message || body?.error || '요청을 완료하지 못했습니다.')
  }
  if (body === null) throw new Error('서버 응답을 읽지 못했습니다.')
  return body
}

function customerAuthError(message: string) {
  const normalized = message.toLowerCase().replaceAll('_', ' ')
  if (normalized.includes('invalid email or password')) {
    return '이메일 또는 비밀번호를 다시 확인해 주세요.'
  }
  if (
    normalized.includes('user already exists') ||
    normalized.includes('account already exists') ||
    normalized.includes('an account already exists')
  ) {
    return '이미 가입된 이메일입니다. 기존 계정으로 로그인해 주세요.'
  }
  if (
    normalized.includes('password') &&
    (normalized.includes('short') || normalized.includes('8'))
  ) {
    return '비밀번호는 8자 이상 입력해 주세요.'
  }
  return Array.from(message).some((character) => (character.codePointAt(0) ?? 0) > 0x7f)
    ? message
    : '계정 요청을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}

function formatDate(value: string | null) {
  if (!value) return '날짜 미기록'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '날짜 미기록'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatMetric(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const normalized = value > 0 && value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}%`
}

function RuntimeLoading({ label }: { label: string }) {
  return (
    <main className="runtime-state" aria-busy="true" aria-live="polite">
      <BrandMark />
      <div className="loading-score" aria-hidden="true">
        {['pulse-a', 'pulse-b', 'pulse-c', 'pulse-d', 'pulse-e', 'pulse-f', 'pulse-g'].map(
          (key) => (
            <span key={key} />
          ),
        )}
      </div>
      <p>{label}</p>
    </main>
  )
}

function BrandMark() {
  return (
    <span className="brand-mark">
      <span className="brand-initials" aria-hidden="true">
        HLB
      </span>
      <span>Vocal Studio</span>
    </span>
  )
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await requestJson(`/api/auth/${mode}/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mode === 'sign-up' ? { name } : {}) }),
      })
      await onAuthenticated()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '로그인하지 못했습니다.'
      setError(customerAuthError(message))
    } finally {
      setSubmitting(false)
    }
  }

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError(null)
    setPassword('')
  }

  return (
    <main className="auth-shell screen-in">
      <section className="auth-story" aria-labelledby="auth-title">
        <div className="auth-brand-row">
          <BrandMark />
          <span className="micro-label">PRIVATE PRACTICE LEDGER</span>
        </div>

        <div className="auth-thesis">
          <p className="eyebrow">28 STAGES · ONE CONTINUOUS VOICE</p>
          <h1 id="auth-title">
            감이 아니라,
            <br />
            <em>쌓인 소리</em>로
            <br />
            성장합니다.
          </h1>
          <p>
            이메일 계정과 HLB 28단계 진도, 평가 기록을 한곳에서 이어봅니다. 기록되지 않은 수치나
            가상의 성과는 표시하지 않습니다.
          </p>
        </div>

        <div className="stage-ruler" aria-label="HLB 28단계 커리큘럼" role="img">
          {curriculum.map((stage) => (
            <span key={stage.id} title={`${stage.id}. ${stage.name}`} />
          ))}
        </div>
      </section>

      <section className="auth-panel" aria-label={mode === 'sign-in' ? '로그인' : '계정 만들기'}>
        <div className="auth-panel-inner">
          <p className="eyebrow">
            {mode === 'sign-in' ? 'RETURN TO PRACTICE' : 'BEGIN YOUR LEDGER'}
          </p>
          <h2>{mode === 'sign-in' ? '내 연습 기록 열기' : '새 연습 계정 만들기'}</h2>
          <p className="auth-guidance">
            {mode === 'sign-in'
              ? '가입한 이메일과 비밀번호를 입력해 주세요.'
              : '새 계정은 기록이 없는 상태에서 시작합니다.'}
          </p>

          <form onSubmit={submit} className="auth-form">
            {mode === 'sign-up' ? (
              <label>
                <span>이름</span>
                <input
                  autoComplete="name"
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="연습자 이름"
                  required
                  value={name}
                />
              </label>
            ) : null}
            <label>
              <span>이메일</span>
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8자 이상"
                required
                type="password"
                value={password}
              />
            </label>
            {error ? (
              <div className="form-error" role="alert">
                <strong>계정을 확인해 주세요.</strong>
                <span>{error}</span>
              </div>
            ) : null}
            <button className="primary-action" disabled={submitting} type="submit">
              {submitting
                ? '기록을 확인하고 있습니다…'
                : mode === 'sign-in'
                  ? '연습 기록 열기'
                  : '계정 만들기'}
            </button>
          </form>

          <div className="auth-mode-row">
            <span>{mode === 'sign-in' ? '처음 사용하시나요?' : '이미 계정이 있나요?'}</span>
            <button
              className="text-action"
              onClick={() => changeMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              type="button"
            >
              {mode === 'sign-in' ? '새 계정 만들기' : '기존 계정으로 로그인'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function StageLedger({ dashboard }: { dashboard: LearnerDashboard }) {
  const progressByStage = useMemo(
    () => new Map(dashboard.progress.map((row) => [row.stage_id, row])),
    [dashboard.progress],
  )

  return (
    <section className="ledger-card" aria-labelledby="stage-ledger-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">CURRICULUM LEDGER</p>
          <h2 id="stage-ledger-title">28단계 소리 지도</h2>
        </div>
        <div className="legend">
          <span className="legend-passed">완료</span>
          <span className="legend-current">다음</span>
          <span>미기록</span>
        </div>
      </header>

      <ol className="stage-grid">
        {curriculum.map((stage) => {
          const progress = progressByStage.get(stage.id)
          const state = progress?.passed
            ? 'passed'
            : stage.id === dashboard.summary.nextStage
              ? 'current'
              : progress
                ? 'attempted'
                : 'pending'
          return (
            <li className={`stage-cell stage-${state}`} key={stage.id}>
              <span className="stage-number">{String(stage.id).padStart(2, '0')}</span>
              <span className="stage-block">{stage.block}</span>
              <strong>{stage.name}</strong>
              <span className="stage-result">
                {progress
                  ? `${progress.best_score}점 · ${progress.attempts}회`
                  : state === 'current'
                    ? '다음 단계'
                    : '미기록'}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function EvaluationLedger({ evaluations }: { evaluations: LearnerEvaluation[] }) {
  return (
    <section className="evaluation-card" aria-labelledby="evaluation-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">VOICE EVALUATIONS</p>
          <h2 id="evaluation-title">최근 평가 기록</h2>
        </div>
        <span className="record-count">{evaluations.length.toLocaleString('ko-KR')}건</span>
      </header>

      {evaluations.length > 0 ? (
        <ol className="evaluation-list">
          {evaluations.map((evaluation) => {
            const stage = stageById(evaluation.stage_id)
            return (
              <li key={evaluation.id}>
                <article>
                  <div className="evaluation-index">
                    <span>STAGE {String(evaluation.stage_id).padStart(2, '0')}</span>
                    <strong>{evaluation.score ?? '—'}</strong>
                  </div>
                  <div className="evaluation-body">
                    <div className="evaluation-meta">
                      <span className={evaluation.passed ? 'result-pass' : 'result-review'}>
                        {evaluation.passed ? '통과' : '재점검'}
                      </span>
                      <time dateTime={evaluation.created_at ?? undefined}>
                        {formatDate(evaluation.created_at)}
                      </time>
                    </div>
                    <h3>{stage.name}</h3>
                    <p>{evaluation.feedback || '기록된 피드백이 없습니다.'}</p>
                    <dl className="metric-row">
                      <div>
                        <dt>음정</dt>
                        <dd>{formatMetric(evaluation.pitch_accuracy)}</dd>
                      </div>
                      <div>
                        <dt>안정도</dt>
                        <dd>{formatMetric(evaluation.tone_stability)}</dd>
                      </div>
                      <div>
                        <dt>긴장</dt>
                        <dd>{evaluation.tension_detected ? '감지' : '미감지'}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">00</span>
          <div>
            <strong>아직 저장된 평가가 없습니다.</strong>
            <p>첫 평가가 저장되면 점수와 음정, 안정도, 피드백이 이곳에 표시됩니다.</p>
          </div>
        </div>
      )}
    </section>
  )
}

function DashboardScreen({
  dashboard,
  user,
  onLogout,
}: {
  dashboard: LearnerDashboard
  user: SessionUser
  onLogout: () => Promise<void>
}) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const completion = Math.round(
    (dashboard.summary.completedStages / dashboard.summary.totalStages) * 100,
  )
  const nextStage = stageById(dashboard.summary.nextStage)
  const displayName = dashboard.profile?.name?.trim() || user.name || '연습자'

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await onLogout()
    } catch {
      setLogoutError('로그아웃하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
      setLoggingOut(false)
    }
  }

  return (
    <main className="dashboard-shell screen-in">
      <header className="app-header">
        <BrandMark />
        <div className="account-actions">
          <span className="account-copy">
            <strong>{displayName}</strong>
            <span>{user.email}</span>
            {logoutError ? <small role="alert">{logoutError}</small> : null}
          </span>
          <button
            className="quiet-action"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            type="button"
          >
            {loggingOut ? '정리 중…' : '로그아웃'}
          </button>
        </div>
      </header>

      <section className="practice-hero" aria-labelledby="practice-title">
        <div className="practice-copy">
          <p className="eyebrow">YOUR NEXT VOICE MARK</p>
          <p className="stage-kicker">
            STAGE {String(nextStage.id).padStart(2, '0')} · {nextStage.block}
          </p>
          <h1 id="practice-title">{nextStage.name}</h1>
          <p className="practice-note">
            {dashboard.summary.completedStages > 0
              ? `${dashboard.summary.completedStages}단계를 통과한 기록에서 이어집니다.`
              : '아직 통과 기록이 없습니다. 첫 단계부터 시작할 준비가 되어 있습니다.'}
          </p>
        </div>

        <div className="completion-seal" aria-label={`전체 진도 ${completion}%`} role="img">
          <span>{String(completion).padStart(2, '0')}</span>
          <small>% COMPLETE</small>
        </div>

        <dl className="practice-summary">
          <div>
            <dt>완료</dt>
            <dd>
              {dashboard.summary.completedStages}
              <small>/28</small>
            </dd>
          </div>
          <div>
            <dt>총 시도</dt>
            <dd>{dashboard.summary.totalAttempts}</dd>
          </div>
          <div>
            <dt>평가</dt>
            <dd>{dashboard.evaluations.length}</dd>
          </div>
          <div>
            <dt>진단</dt>
            <dd>{dashboard.profile?.has_onboarding_result ? '완료' : '미기록'}</dd>
          </div>
        </dl>
      </section>

      <StageLedger dashboard={dashboard} />
      <EvaluationLedger evaluations={dashboard.evaluations} />

      <footer className="app-footer">
        <span>{productContract.displayName}</span>
        <span>실제 계정 · 진도 · 평가 기록</span>
      </footer>
    </main>
  )
}

function VocalmindRuntime() {
  const [screen, setScreen] = useState<ScreenState>('checking')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [dashboard, setDashboard] = useState<LearnerDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setScreen('loading-dashboard')
    setError(null)
    try {
      const sessionResponse = await fetch('/api/auth/get-session', { credentials: 'include' })
      if (!sessionResponse.ok) throw new Error('계정 세션을 확인하지 못했습니다.')
      const session = (await sessionResponse.json()) as { user?: SessionUser } | null
      if (!session?.user) {
        setUser(null)
        setDashboard(null)
        setScreen('signed-out')
        return
      }
      const result = await requestJson<{ learner: LearnerDashboard }>('/api/me/dashboard?limit=20')
      setUser(session.user)
      setDashboard(result.learner)
      setScreen('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '연습 기록을 불러오지 못했습니다.')
      setScreen('error')
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const logout = async () => {
    await requestJson('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    setUser(null)
    setDashboard(null)
    setScreen('signed-out')
  }

  if (screen === 'checking' || screen === 'loading-dashboard') {
    return <RuntimeLoading label="계정과 28단계 기록을 확인하고 있습니다…" />
  }
  if (screen === 'signed-out') return <AuthScreen onAuthenticated={loadDashboard} />
  if (screen === 'ready' && user && dashboard) {
    return <DashboardScreen dashboard={dashboard} onLogout={logout} user={user} />
  }
  return (
    <main className="runtime-state runtime-error screen-in">
      <BrandMark />
      <p className="eyebrow">CONNECTION CHECK</p>
      <h1>연습 기록을 불러오지 못했습니다.</h1>
      <p>{error || '잠시 뒤 다시 시도해 주세요.'}</p>
      <button className="primary-action" onClick={() => void loadDashboard()} type="button">
        다시 연결하기
      </button>
    </main>
  )
}
