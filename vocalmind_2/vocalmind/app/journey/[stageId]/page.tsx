import PracticeClient from './PracticeClient';

export default async function PracticePage({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  return <PracticeClient stageId={parseInt(stageId, 10)} />;
}
