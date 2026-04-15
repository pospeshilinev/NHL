import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminForm from './AdminForm';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const { data: me } = await supabase
    .from('users').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return <main className="p-6">Forbidden</main>;

  const { data: season } = await supabase
    .from('seasons').select('*').eq('is_active', true).maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <AdminForm season={season} />
    </main>
  );
}
