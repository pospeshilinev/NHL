import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import AdminForm from './AdminForm';
import UsersSection from './UsersSection';
import { saveSeason, runSync, createUser, resetUserPassword, deleteUser } from './actions';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if ((session.user as any).role !== 'admin') return <main className="p-6">Forbidden</main>;

  const [season] = await query<any>('select * from seasons where is_active = true limit 1');
  const users = await query<any>(
    'select id, username, display_name, role, created_at from users order by id',
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 space-y-10">
      <section>
        <h1 className="text-2xl font-bold mb-4">Сезон</h1>
        <AdminForm season={season ?? null} saveAction={saveSeason} syncAction={runSync} />
      </section>
      <section>
        <h2 className="text-xl font-bold mb-4">Пользователи</h2>
        <UsersSection
          users={users}
          currentUserId={Number((session.user as any).id)}
          createAction={createUser}
          resetAction={resetUserPassword}
          deleteAction={deleteUser}
        />
      </section>
    </main>
  );
}
