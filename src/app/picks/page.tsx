import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PicksForm from './PicksForm';

export default async function PicksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const { data: season } = await supabase
    .from('seasons').select('*').eq('is_active', true).single();
  if (!season) return <main className="p-6">No active season</main>;

  const { data: series } = await supabase
    .from('series').select('*').eq('season_id', season.id)
    .order('round').order('conference').order('slot');

  const { data: picks } = await supabase
    .from('picks').select('*').eq('user_id', user.id);

  const { data: bonus } = await supabase
    .from('bonus_picks').select('*').eq('user_id', user.id).eq('season_id', season.id).maybeSingle();

  const locked = new Date(season.picks_deadline) < new Date();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PicksForm
        season={season}
        series={series ?? []}
        picks={picks ?? []}
        bonus={bonus}
        locked={locked}
      />
    </main>
  );
}
