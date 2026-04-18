import { Metadata } from 'next';
import StudioHomeClient from './StudioHomeClient';

export const metadata: Metadata = {
  title: 'AI 스튜디오 — 보컬마인드',
  description: '내 목소리로 뮤직비디오를 만들어요',
};

export default function StudioPage() {
  return <StudioHomeClient />;
}
