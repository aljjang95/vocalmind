'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarMode, QualityTier, StylePreset } from '@/types/studio';
import {
  DEFAULT_STUDIO_TIER,
  STUDIO_TIERS,
  STUDIO_TIER_ORDER,
  formatKrw,
  studioTier,
} from '@/types/studio';

type Step = 'mr' | 'record' | 'style' | 'tier' | 'avatar' | 'submit';

const STEP_ORDER: Step[] = ['mr', 'record', 'style', 'tier', 'avatar', 'submit'];

function prevStep(current: Step): Step | null {
  const idx = STEP_ORDER.indexOf(current);
  return idx > 0 ? STEP_ORDER[idx - 1] : null;
}

const STYLES: { id: StylePreset; label: string; desc: string }[] = [
  { id: 'cinematic', label: '시네마틱', desc: '영화적인 조명과 컬러 그레이딩' },
  { id: 'cozy', label: '포근', desc: '따뜻하고 편안한 무드' },
  { id: 'retro', label: '네온 레트로', desc: 'Blade Runner 사이버펑크' },
  { id: 'ghibli', label: '지브리', desc: '수채화 감성 애니메이션' },
  { id: 'neon_city', label: '네온 시티', desc: '사이버펑크 야경과 네온 반사' },
  { id: 'fantasy', label: '판타지', desc: '초현실 꿈결 같은 마법 세계' },
];

const AVATARS: { id: AvatarMode; label: string; desc: string }[] = [
  { id: 'user_photo', label: '내 사진 아바타', desc: '본인 사진으로 애니메이션' },
  { id: 'ai_realistic', label: 'AI 실사', desc: '실사 느낌의 가상 모델' },
  { id: 'ai_anime', label: '애니', desc: '애니메이션 스타일 캐릭터' },
  { id: 'faceless', label: '무얼굴', desc: '인물 없이 풍경·오브제만' },
];

export default function NewCoverWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('mr');
  const [mrPath, setMrPath] = useState<string | null>(null);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [stylePreset, setStylePreset] = useState<StylePreset | null>(null);
  const [qualityTier, setQualityTier] = useState<QualityTier>(DEFAULT_STUDIO_TIER);
  const [avatarMode, setAvatarMode] = useState<AvatarMode | null>(null);
  const [avatarRefPath, setAvatarRefPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/credits/balance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { balance: number } | null) => {
        if (active && d) setBalance(d.balance);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const upload = useCallback(
    async (file: File, kind: 'mr' | 'recording' | 'avatar'): Promise<string | null> => {
      setError(null);
      setErrorCode(null);
      setIsUploading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('kind', kind);
        const res = await fetch('/api/studio/upload', { method: 'POST', body: form });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setError(err.error ?? `업로드 실패 (${res.status})`);
          return null;
        }
        const { storagePath } = (await res.json()) as { storagePath: string };
        return storagePath;
      } catch (e) {
        setError(e instanceof Error ? e.message : '업로드 오류');
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!mrPath || !recordingPath || !stylePreset || !avatarMode) {
      setError('모든 단계를 완료해주세요');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/studio/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMrPath: mrPath,
          rawRecordingPath: recordingPath,
          stylePreset,
          qualityTier,
          avatarMode,
          avatarRefPath: avatarMode === 'user_photo' ? avatarRefPath : null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string; hint?: string };
        if (err.code === 'INSUFFICIENT_CREDITS') {
          setError('크레딧이 부족해요. 충전 후 다시 시도하세요.');
          setErrorCode('INSUFFICIENT_CREDITS');
        } else if (err.code === 'VOICE_IDENTITY_REQUIRED' || err.code === 'VOICE_IDENTITY_NOT_READY') {
          router.push(err.hint ?? '/studio/voice-identity');
          return;
        } else {
          setError(err.error ?? `생성 실패 (${res.status})`);
          setErrorCode(err.code ?? null);
        }
        return;
      }
      const { jobId } = (await res.json()) as { jobId: string };
      router.push(`/studio/${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 오류');
    } finally {
      setIsSubmitting(false);
    }
  }, [mrPath, recordingPath, stylePreset, qualityTier, avatarMode, avatarRefPath, router]);

  const currentTier = studioTier(qualityTier);

  return (
    <main className="mx-auto max-w-[720px] px-5 py-10">
      <header className="mb-8">
        <h1 className="text-[24px] font-extrabold text-white">새 커버 만들기</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60">
          <span>약 15분 소요 ·</span>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-200">
            {currentTier.credits}크레딧 = {formatKrw(currentTier.priceKrw)} ({currentTier.durationSec}초)
          </span>
          <span>· 실패 시 자동 환불</span>
        </div>
      </header>

      <StepIndicator step={step} />

      {prevStep(step) !== null && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setErrorCode(null);
            const p = prevStep(step);
            if (p) setStep(p);
          }}
          disabled={isUploading || isSubmitting}
          className="mb-4 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:border-white/25 hover:text-white/90 disabled:opacity-40"
        >
          ← 이전 단계
        </button>
      )}

      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          <span>{error}</span>
          {errorCode === 'INSUFFICIENT_CREDITS' && (
            <button
              type="button"
              onClick={() => router.push('/credits')}
              className="rounded-md bg-red-400/20 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-400/30"
            >
              크레딧 충전하기 →
            </button>
          )}
        </div>
      )}

      {step === 'mr' && (
        <FileStep
          title="1. MR 업로드"
          desc="본인이 소유한 MR(반주/인스트루멘탈)을 업로드하세요."
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/ogg"
          kind="mr"
          isUploading={isUploading}
          onUploaded={(path) => {
            setMrPath(path);
            setStep('record');
          }}
          upload={upload}
          hints={[
            'MP3 / WAV / OGG / WebM — 최대 40MB',
            '길이 1~4분 권장 (5분 초과 시 비용 증가)',
            '보컬 제거된 순수 반주만',
            '저작권 있는 곡은 SNS 배포 금지 (본인 소장용만 허용)',
          ]}
          validate={(file) => {
            if (file.size > 40 * 1024 * 1024) {
              return '파일이 40MB를 초과합니다';
            }
            return null;
          }}
        />
      )}

      {step === 'record' && (
        <RecordStep
          onRecorded={async (blob) => {
            const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
            const path = await upload(file, 'recording');
            if (path) {
              setRecordingPath(path);
              setStep('style');
            }
          }}
          isUploading={isUploading}
        />
      )}

      {step === 'style' && (
        <ChoiceStep
          title="3. 스타일 선택"
          items={STYLES}
          selected={stylePreset}
          onSelect={(id) => {
            setStylePreset(id);
            setStep('tier');
          }}
        />
      )}

      {step === 'tier' && (
        <TierStep
          selected={qualityTier}
          onSelect={(tier) => {
            setQualityTier(tier);
            setStep('avatar');
          }}
        />
      )}

      {step === 'avatar' && (
        <AvatarStep
          selected={avatarMode}
          onSelect={(mode) => setAvatarMode(mode)}
          onUploadPhoto={async (file) => {
            const path = await upload(file, 'avatar');
            if (path) setAvatarRefPath(path);
          }}
          avatarRefPath={avatarRefPath}
          isUploading={isUploading}
          onNext={() => setStep('submit')}
        />
      )}

      {step === 'submit' && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-6">
          <h2 className="text-lg font-bold text-white">모든 준비가 끝났어요</h2>

          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-black/20 p-4 text-sm">
            <dt className="text-white/50">스타일</dt>
            <dd className="text-white">{STYLES.find((s) => s.id === stylePreset)?.label ?? '-'}</dd>
            <dt className="text-white/50">품질 티어</dt>
            <dd className="text-white">
              {currentTier.tier.toUpperCase()} · {currentTier.modelLabel}
            </dd>
            <dt className="text-white/50">영상 길이</dt>
            <dd className="text-white">{currentTier.durationSec}초 · {currentTier.imageResolution}</dd>
            <dt className="text-white/50">아바타</dt>
            <dd className="text-white">{AVATARS.find((a) => a.id === avatarMode)?.label ?? '-'}</dd>
            <dt className="text-white/50">비용</dt>
            <dd className="font-semibold text-emerald-200">
              {currentTier.credits}크레딧 ({formatKrw(currentTier.priceKrw)})
            </dd>
            <dt className="text-white/50">완성까지</dt>
            <dd className="text-white">
              약 {currentTier.tier === 'draft' ? '5분' : currentTier.tier === 'pro' ? '12분' : '25분'}
            </dd>
          </dl>

          {balance !== null && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-black/20 px-3 py-2 text-xs">
              <span className="text-white/50">현재 잔액</span>
              <span
                className={
                  balance < currentTier.credits
                    ? 'font-semibold text-red-300'
                    : 'font-semibold text-emerald-200'
                }
              >
                {balance}크레딧
                {balance < currentTier.credits && ' (부족)'}
              </span>
            </div>
          )}

          <p className="mt-3 text-xs text-white/50">
            실패 시 {currentTier.credits}크레딧은 자동으로 환불됩니다. 취소는 처리 시작 전에만 가능해요.
          </p>

          {balance !== null && balance < currentTier.credits ? (
            <button
              type="button"
              onClick={() => router.push('/credits')}
              className="mt-5 w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              크레딧 충전하러 가기 →
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={submit}
              className="mt-5 w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? '제출 중...'
                : `${currentTier.credits}크레딧 차감하고 생성 시작`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'mr', label: 'MR' },
    { id: 'record', label: '녹음' },
    { id: 'style', label: '스타일' },
    { id: 'tier', label: '품질' },
    { id: 'avatar', label: '아바타' },
    { id: 'submit', label: '제출' },
  ];
  const activeIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-8 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
              i <= activeIdx
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs ${i <= activeIdx ? 'text-white/80' : 'text-white/30'}`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className="h-px flex-1 bg-white/10" />
          )}
        </div>
      ))}
    </div>
  );
}

function FileStep({
  title, desc, accept, kind, isUploading, onUploaded, upload, hints, validate,
}: {
  title: string;
  desc: string;
  accept: string;
  kind: 'mr' | 'recording' | 'avatar';
  isUploading: boolean;
  onUploaded: (path: string) => void;
  upload: (f: File, k: 'mr' | 'recording' | 'avatar') => Promise<string | null>;
  hints?: string[];
  validate?: (file: File) => string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-white/60">{desc}</p>

      {hints && hints.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-white/50">
          {hints.map((h) => (
            <li key={h} className="flex items-start gap-2">
              <span className="text-emerald-400/70">·</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setLocalError(null);
          if (validate) {
            const err = validate(f);
            if (err) {
              setLocalError(err);
              // input 초기화 (같은 파일 재선택 가능)
              if (inputRef.current) inputRef.current.value = '';
              return;
            }
          }
          const path = await upload(f, kind);
          if (path) onUploaded(path);
        }}
      />

      {localError && (
        <div className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {localError}
        </div>
      )}

      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
      >
        {isUploading ? '업로드 중...' : '파일 선택'}
      </button>
    </div>
  );
}

function RecordStep({
  onRecorded, isUploading,
}: {
  onRecorded: (blob: Blob) => void;
  isUploading: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; durationSec: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // 이전 미리듣기 URL 누수 방지 — blob URL revoke.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const start = async () => {
    try {
      if (preview) {
        URL.revokeObjectURL(preview.url);
        setPreview(null);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        setPreview({ blob, url: URL.createObjectURL(blob), durationSec });
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } catch {
      alert('마이크 권한이 필요해요');
    }
  };

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const confirmAndUpload = () => {
    if (!preview) return;
    if (preview.durationSec < 5) {
      alert('녹음이 너무 짧아요. 최소 5초 이상 녹음해주세요.');
      return;
    }
    onRecorded(preview.blob);
  };

  const retake = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    }
    setElapsed(0);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-bold text-white">2. 녹음</h2>
      <p className="mt-1 text-sm text-white/60">
        MR을 다른 기기나 스피커로 재생하며 직접 녹음하세요. 3분 내외 권장, 최소 5초.
      </p>

      {!preview ? (
        <div className="mt-5 flex items-center gap-4">
          {!isRecording ? (
            <button
              type="button"
              disabled={isUploading}
              onClick={start}
              className="h-16 w-16 rounded-full bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
              aria-label="녹음 시작"
            >
              ●
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="h-16 w-16 rounded-full bg-white text-black"
              aria-label="정지"
            >
              ■
            </button>
          )}
          <div className="font-mono text-lg text-white">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
            {String(elapsed % 60).padStart(2, '0')}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs text-white/60">
              녹음 길이: {preview.durationSec}초
            </div>
            <audio controls src={preview.url} className="w-full" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isUploading}
              onClick={confirmAndUpload}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {isUploading ? '업로드 중...' : '이 녹음으로 계속 →'}
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={retake}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30 hover:text-white/90 disabled:opacity-50"
            >
              다시 녹음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceStep<T extends string>({
  title, items, selected, onSelect,
}: {
  title: string;
  items: { id: T; label: string; desc: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              selected === it.id
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="text-sm font-semibold text-white">{it.label}</div>
            <div className="mt-1 text-xs text-white/50">{it.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AvatarStep({
  selected, onSelect, onUploadPhoto, avatarRefPath, isUploading, onNext,
}: {
  selected: AvatarMode | null;
  onSelect: (mode: AvatarMode) => void;
  onUploadPhoto: (f: File) => Promise<void>;
  avatarRefPath: string | null;
  isUploading: boolean;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const needsPhoto = selected === 'user_photo';
  const canProceed = selected !== null && (!needsPhoto || avatarRefPath !== null);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-bold text-white">5. 아바타 선택</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {AVATARS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              selected === a.id
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="text-sm font-semibold text-white">{a.label}</div>
            <div className="mt-1 text-xs text-white/50">{a.desc}</div>
          </button>
        ))}
      </div>

      {needsPhoto && (
        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="text-sm text-white/80">본인 사진을 업로드해주세요</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onUploadPhoto(f);
            }}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 disabled:opacity-50"
          >
            {avatarRefPath ? '다시 선택' : isUploading ? '업로드 중...' : '사진 선택'}
          </button>
          {avatarRefPath && (
            <div className="mt-2 text-xs text-emerald-300">사진 업로드 완료</div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!canProceed}
        onClick={onNext}
        className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}

// ── 4. 품질 티어 선택 ───────────────────────────────────────
// 마스터 각인: 품질 최우선, 낭비 방지.
// 3카드 구조 — Draft(체험), Pro(표준·추천), Studio(프리미엄)
function TierStep({
  selected,
  onSelect,
}: {
  selected: QualityTier;
  onSelect: (tier: QualityTier) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-bold text-white">4. 품질 티어</h2>
      <p className="mt-1 text-sm text-white/60">
        같은 MR·같은 목소리라도 이미지·영상 모델에 따라 결과물이 달라집니다.
        처음이면 <span className="text-emerald-300">Draft</span>로 결과를 먼저 보세요.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {STUDIO_TIER_ORDER.map((tierId) => {
          const t = STUDIO_TIERS[tierId];
          const isSelected = selected === tierId;
          return (
            <button
              key={tierId}
              type="button"
              onClick={() => onSelect(tierId)}
              aria-pressed={isSelected}
              className={`relative rounded-xl border p-4 text-left transition ${
                isSelected
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-white/10 bg-black/20 hover:border-white/30'
              }`}
            >
              {t.recommended && (
                <span className="absolute -top-2 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  추천
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold uppercase text-white">{t.tier}</span>
                <span className="text-xs text-white/50">{t.durationSec}초</span>
              </div>

              <div className="mt-2 text-[22px] font-extrabold text-emerald-200">
                {formatKrw(t.priceKrw)}
              </div>
              <div className="text-[11px] text-white/50">{t.credits}크레딧</div>

              <p className="mt-3 text-xs text-white/70">{t.tagline}</p>

              <dl className="mt-3 space-y-1 text-[11px] text-white/50">
                <div className="flex justify-between gap-2">
                  <dt>모델</dt>
                  <dd className="text-right text-white/70">{t.modelLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>해상도</dt>
                  <dd className="text-white/70">{t.imageResolution}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>씬 수</dt>
                  <dd className="text-white/70">{t.sceneCount}개</dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-white/40">
        💡 실패 시 크레딧은 자동 환불됩니다. 티어를 올릴수록 렌더 시간이 길어집니다.
      </p>
    </div>
  );
}
