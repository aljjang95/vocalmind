import { Metadata } from 'next';
import CoverDetailClient from './CoverDetailClient';

export const metadata: Metadata = {
  title: '커버 상세 — AI 스튜디오',
};

export default async function CoverDetailPage({
  params,
}: {
  params: Promise<{ coverId: string }>;
}) {
  const { coverId } = await params;
  return <CoverDetailClient jobId={coverId} />;
}
