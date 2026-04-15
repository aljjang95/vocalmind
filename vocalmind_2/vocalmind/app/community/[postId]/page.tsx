import { Metadata } from 'next';
import PostDetailClient from './PostDetailClient';

interface Props {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  return {
    title: `게시글 | HLB 보컬스튜디오`,
    description: `보컬 커버 게시글 (${postId})`,
  };
}

export default async function PostDetailPage({ params }: Props) {
  const { postId } = await params;
  return <PostDetailClient postId={postId} />;
}
