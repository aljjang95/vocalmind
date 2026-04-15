import { redirect } from 'next/navigation';

// coaching → coach로 통합
export default function CoachingPage() {
  redirect('/coach');
}
