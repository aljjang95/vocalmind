import ScalePracticeClient from './ScalePracticeClient';

export default function Page({ params }: { params: { stageId: string } }) {
  return <ScalePracticeClient stageId={parseInt(params.stageId, 10)} />;
}
