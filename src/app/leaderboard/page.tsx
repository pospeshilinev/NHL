import { query } from '@/lib/db';

export default async function LeaderboardPage() {
  const [season] = await query<any>('select * from seasons where is_active = true limit 1');
  if (!season) return <main className="p-6">No active season</main>;

  const rows = await query<any>(
    `select * from leaderboard where season_id = $1 order by total_points desc`,
    [season.id],
  );

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Leaderboard {season.year}</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr><th>#</th><th>Name</th><th className="text-right">Points</th></tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
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
