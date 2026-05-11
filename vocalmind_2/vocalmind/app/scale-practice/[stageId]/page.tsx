import ScalePracticeClient from './ScalePracticeClient';

export default async function Page({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  return <ScalePracticeClient stageId={parseInt(stageId, 10)} />;
}
