'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>문제가 발생했습니다</h2>
      <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
        다시 시도
      </button>
    </div>
  );
}
