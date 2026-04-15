import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import PicksForm from './PicksForm';
import { savePicks } from './actions';

export default async function PicksPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const userId = (session.user as any).id as number;

  const [season] = await query<any>(
    'select * from seasons where is_active = true limit 1',
  );
  if (!season) return <main className="p-6">No active season</main>;

  const series = await query<any>(
    `select * from series where season_id = $1
     order by round, conference nulls last, slot`,
    [season.id],
  );

  const picks = await query<any>(
    'select * from picks where user_id = $1',
    [userId],
  );

  const [bonus] = await query<any>(
    'select * from bonus_picks where user_id = $1 and season_id = $2',
    [userId, season.id],
  );

  const locked = new Date(season.picks_deadline) < new Date();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PicksForm
        season={season}
        series={series}
        picks={picks}
        bonus={bonus ?? null}
        locked={locked}
        action={savePicks}
      />
    </main>
  );
}
