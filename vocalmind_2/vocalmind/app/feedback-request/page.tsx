import type { Metadata } from 'next';
import FeedbackRequestClient from './FeedbackRequestClient';

export const metadata: Metadata = {
  title: '유료 피드백 신청 | HLB 보컬스튜디오',
  description: '녹음을 업로드하면 선생님이 직접 듣고 개인 맞춤 피드백을 보내드려요.',
};

export default function FeedbackRequestPage() {
  return <FeedbackRequestClient />;
}
