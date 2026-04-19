import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminStudioClient from './AdminStudioClient';

export const metadata = { title: 'Studio 장애 복구 | 관리자 — 보컬마인드' };

export default async function AdminStudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.TEACHER_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    redirect('/auth/login');
  }

  return <AdminStudioClient />;
}
