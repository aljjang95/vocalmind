import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TeacherClient from './TeacherClient';

export const metadata = { title: '선생님 대시보드 | HLB 보컬스튜디오' };

export default async function TeacherPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const teacherEmail = process.env.TEACHER_EMAIL;
  if (!user || user.email !== teacherEmail) {
    redirect('/auth/login');
  }

  return <TeacherClient />;
}
