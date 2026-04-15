import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: '40px 20px',
          gap: '20px',
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '1.8rem',
            fontWeight: 700,
          }}
        >
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', maxWidth: '400px' }}>
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <Link href="/" className="btn-primary">
            홈으로 돌아가기
          </Link>
          <Link href="/diagnosis" className="btn-outline">
            보컬 진단 받기
          </Link>
        </div>
      </main>
    </>
  );
}
