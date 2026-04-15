'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { VoiceType, ExperienceLevel } from '@/types';

const VOICE_TYPES: VoiceType[] = ['저음', '중음', '고음'];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['초보', '중급', '고급'];
const GENRES = ['팝', 'R&B', '발라드', '록', '재즈', '뮤지컬', '클래식', '힙합', '인디'];

export default function StepBasicInfo() {
  const { basicInfo, setBasicInfo, setStep } = useDiagnosisStore();

  const canProceed =
    basicInfo.nickname.trim().length >= 1 &&
    basicInfo.nickname.trim().length <= 20;

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      <h2 className="text-[1.6rem] max-md:text-[1.3rem] font-bold mb-2">기본 정보를 알려주세요</h2>
      <p className="text-[0.9rem] text-[var(--text2)] mb-7 leading-relaxed">당신에게 맞는 진단을 위해 기본적인 정보가 필요해요.</p>

      <div className="mb-[22px] relative">
        <label className="block text-[0.82rem] font-semibold text-[var(--text2)] mb-2">닉네임</label>
        <input
          type="text"
          className="w-full py-3 px-4 bg-[var(--surface2)] border border-[var(--border)] rounded-[var(--r-xs)] text-[var(--text)] text-[0.9rem] outline-none transition-colors duration-200 focus:border-blue-500/50 placeholder:text-[var(--muted)]"
          placeholder="불러드릴 이름을 입력하세요"
          value={basicInfo.nickname}
          onChange={(e) => setBasicInfo({ nickname: e.target.value.slice(0, 20) })}
          maxLength={20}
        />
      </div>

      <div className="mb-[22px]">
        <label className="block text-[0.82rem] font-semibold text-[var(--text2)] mb-2">음역대</label>
        <div className="flex flex-wrap gap-2">
          {VOICE_TYPES.map((vt) => (
            <button
              key={vt}
              type="button"
              className={`px-[18px] py-2 border rounded-[20px] text-[0.82rem] cursor-pointer transition-all duration-200 ${
                basicInfo.voiceType === vt
                  ? 'bg-blue-500/[0.12] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--border2)] hover:text-[var(--text)]'
              }`}
              onClick={() => setBasicInfo({ voiceType: vt })}
            >
              {vt}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-[22px]">
        <label className="block text-[0.82rem] font-semibold text-[var(--text2)] mb-2">경험 수준</label>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map((exp) => (
            <button
              key={exp}
              type="button"
              className={`px-[18px] py-2 border rounded-[20px] text-[0.82rem] cursor-pointer transition-all duration-200 ${
                basicInfo.experience === exp
                  ? 'bg-blue-500/[0.12] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--border2)] hover:text-[var(--text)]'
              }`}
              onClick={() => setBasicInfo({ experience: exp })}
            >
              {exp}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-[22px]">
        <label className="block text-[0.82rem] font-semibold text-[var(--text2)] mb-2">선호 장르 (선택)</label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              className={`px-[18px] py-2 border rounded-[20px] text-[0.82rem] cursor-pointer transition-all duration-200 ${
                basicInfo.genre === g
                  ? 'bg-blue-500/[0.12] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--border2)] hover:text-[var(--text)]'
              }`}
              onClick={() => setBasicInfo({ genre: basicInfo.genre === g ? '' : g })}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 gap-3 max-[560px]:flex-col-reverse max-[560px]:[&>*]:w-full max-[560px]:[&>*]:text-center max-[560px]:[&>*]:justify-center">
        <div />
        <button
          type="button"
          className="btn-primary"
          disabled={!canProceed}
          onClick={() => setStep(1)}
        >
          다음 단계 &rarr;
        </button>
      </div>
    </div>
  );
}
