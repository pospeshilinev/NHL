import { createClient } from '@/lib/supabase/server';

export default async function LeaderboardPage() {
  const supabase = createClient();
  const { data: season } = await supabase
    .from('seasons').select('*').eq('is_active', true).single();
  if (!season) return <main className="p-6">No active season</main>;

  const { data } = await supabase
    .from('leaderboard').select('*').eq('season_id', season.id)
    .order('total_points', { ascending: false });

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Leaderboard {season.year}</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr><th>#</th><th>Name</th><th className="text-right">Points</th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((row: any, i: number) => (
            <tr key={row.user_id} className="border-t border-neutral-800">
              <td className="py-2">{i + 1}</td>
              <td>{row.display_name}</td>
              <td className="text-right font-mono">{row.total_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
