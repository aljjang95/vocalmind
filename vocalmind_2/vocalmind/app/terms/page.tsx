export const metadata = { title: '이용약관 | HLB 보컬스튜디오' };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] pt-24 pb-16 px-6">
      <div className="max-w-[720px] mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">이용약관</h1>

        <div className="space-y-6 text-[var(--text-secondary)] text-[0.9rem] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">제1조 (목적)</h2>
            <p>이 약관은 HLB 보컬스튜디오(이하 &quot;서비스&quot;)가 제공하는 보컬 트레이닝 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리·의무를 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">제2조 (서비스 내용)</h2>
            <p>서비스는 AI 기반 보컬 분석, 커리큘럼 제공, 실시간 피드백, 커뮤니티 기능 등 보컬 트레이닝 관련 서비스를 제공합니다. 서비스의 세부 내용은 요금제에 따라 다를 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">제3조 (이용자의 의무)</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>녹음된 음성 데이터를 타인의 동의 없이 무단 사용하지 않습니다.</li>
              <li>서비스를 상업적으로 재배포하지 않습니다.</li>
              <li>저작권이 있는 음원의 무단 배포를 금지합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">제4조 (결제 및 환불)</h2>
            <p>유료 서비스는 토스페이먼츠를 통해 결제됩니다. 결제 후 7일 이내, 서비스를 이용하지 않은 경우 전액 환불이 가능합니다. 환불 요청은 문의하기를 통해 접수해 주세요.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">제5조 (면책)</h2>
            <p>AI 분석 결과는 참고용이며, 전문적인 의료·음악 교육을 대체하지 않습니다. 서비스 이용 중 발생한 건강 문제에 대해 서비스는 책임을 지지 않습니다.</p>
          </section>

          <p className="text-[var(--text-dim)] text-xs mt-8">시행일: 2026년 4월 1일</p>
        </div>
      </div>
    </main>
  );
}
