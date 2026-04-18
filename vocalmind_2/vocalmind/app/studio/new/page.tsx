import { Metadata } from 'next';
import NewCoverWizardClient from './NewCoverWizardClient';

export const metadata: Metadata = {
  title: '새 커버 만들기 — AI 스튜디오',
};

export default function NewCoverPage() {
  return <NewCoverWizardClient />;
}
