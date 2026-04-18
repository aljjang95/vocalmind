import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminVoicesClient from './AdminVoicesClient';

export const metadata = { title: '음색 승인 | 관리자 — 보컬마인드' };

export default async function AdminVoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.TEACHER_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    redirect('/auth/login');
  }

  return <AdminVoicesClient />;
}
