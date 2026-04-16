export const metadata = { title: '개인정보처리방침 | HLB 보컬스튜디오' };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] pt-24 pb-16 px-6">
      <div className="max-w-[720px] mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">개인정보처리방침</h1>

        <div className="space-y-6 text-[var(--text-secondary)] text-[0.9rem] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">1. 수집하는 개인정보 항목</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong>회원가입:</strong> 이메일 주소, 이름</li>
              <li><strong>서비스 이용:</strong> 음성 녹음 데이터, 연습 기록, AI 분석 결과</li>
              <li><strong>결제:</strong> 결제 수단 정보 (토스페이먼츠를 통해 처리, 카드 정보는 서비스에 저장되지 않음)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">2. 개인정보 이용 목적</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>보컬 트레이닝 서비스 제공 및 AI 분석</li>
              <li>학습 진도 추적 및 맞춤 커리큘럼 제공</li>
              <li>결제 처리 및 요금제 관리</li>
              <li>서비스 개선 및 통계 분석 (비식별 처리)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">3. 개인정보 보유 기간</h2>
            <p>회원 탈퇴 시 즉시 삭제합니다. 단, 법률에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다 (전자상거래법: 결제 기록 5년).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">4. 음성 데이터 처리</h2>
            <p>녹음된 음성 데이터는 AI 분석 목적으로만 사용됩니다. 분석 완료 후 원본 음성 파일은 서버에 장기 보관하지 않으며, 분석 결과(수치)만 저장됩니다. 음성 데이터는 제3자에게 제공되지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">5. 제3자 제공</h2>
            <p>원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 이용자의 사전 동의가 있거나 법률에 의해 요구되는 경우는 예외입니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">6. 개인정보 보호 조치</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Supabase Row Level Security (RLS)를 통한 데이터 접근 제어</li>
              <li>HTTPS 암호화 통신</li>
              <li>API 키 및 인증 토큰의 서버 측 관리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">7. 문의</h2>
            <p>개인정보 관련 문의: <a href="mailto:heartytn@naver.com" className="text-[var(--accent)] underline">heartytn@naver.com</a></p>
          </section>

          <p className="text-[var(--text-dim)] text-xs mt-8">시행일: 2026년 4월 1일</p>
        </div>
      </div>
    </main>
  );
}
