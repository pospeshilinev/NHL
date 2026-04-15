import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import AdminForm from './AdminForm';
import { saveSeason, runSync } from './actions';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const userId = (session.user as any).id as number;

  const [me] = await query<any>('select role from users where id = $1', [userId]);
  if (me?.role !== 'admin') return <main className="p-6">Forbidden</main>;

  const [season] = await query<any>('select * from seasons where is_active = true limit 1');

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <AdminForm season={season ?? null} saveAction={saveSeason} syncAction={runSync} />
    </main>
  );
}
