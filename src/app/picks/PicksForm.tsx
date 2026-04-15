'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

type Series = {
  id: string; round: number; conference: 'E' | 'W' | null; slot: number;
  team_high: string | null; team_low: string | null;
};
type Pick = { series_id: string; winner: string; games: number };
type Bonus = {
  east_cf_team_a: string; east_cf_team_b: string;
  west_cf_team_a: string; west_cf_team_b: string;
  cup_finalist_east: string; cup_finalist_west: string;
  cup_winner: string;
} | null;

export default function PicksForm({ season, series, picks, bonus, locked }: {
  season: { id: string; picks_deadline: string };
  series: Series[]; picks: Pick[]; bonus: Bonus; locked: boolean;
}) {
  const t = useTranslations('picks');
  const supabase = createClient();
  const [state, setState] = useState<Record<string, { winner: string; games: number }>>(
    Object.fromEntries(picks.map((p) => [p.series_id, { winner: p.winner, games: p.games }])),
  );
  const [bonusState, setBonusState] = useState<NonNullable<Bonus>>(bonus ?? {
    east_cf_team_a: '', east_cf_team_b: '', west_cf_team_a: '', west_cf_team_b: '',
    cup_finalist_east: '', cup_finalist_west: '', cup_winner: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const rows = Object.entries(state)
      .filter(([, v]) => v.winner && v.games)
      .map(([series_id, v]) => ({ user_id: user.id, series_id, winner: v.winner, games: v.games }));
    await supabase.from('picks').upsert(rows, { onConflict: 'user_id,series_id' });
    await supabase.from('bonus_picks').upsert(
      { ...bonusState, user_id: user.id, season_id: season.id },
      { onConflict: 'user_id,season_id' },
    );
    setSaving(false);
    setMsg(t('save') + ' ✓');
  }

  const byRound = (r: number) => series.filter((s) => s.round === r);

  return (
    <div className="space-y-8">
      {locked && <div className="rounded bg-yellow-900/40 p-3">{t('locked')}</div>}

      {[1, 2, 3, 4].map((r) => (
        <section key={r}>
          <h2 className="font-semibold mb-3">
            {r === 1 ? t('round1') : r === 2 ? t('round2') : r === 3 ? t('cf') : t('scf')}
          </h2>
          <div className="space-y-2">
            {byRound(r).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded border border-neutral-800 p-3">
                <div className="flex-1 text-sm">
                  {s.team_high ?? '—'} vs {s.team_low ?? '—'}
                </div>
                <input
                  disabled={locked}
                  placeholder={t('winner')}
                  value={state[s.id]?.winner ?? ''}
                  onChange={(e) => setState((p) => ({ ...p, [s.id]: { ...p[s.id], winner: e.target.value, games: p[s.id]?.games ?? 4 } }))}
                  className="w-40 rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
                />
                <select
                  disabled={locked}
                  value={state[s.id]?.games ?? 4}
                  onChange={(e) => setState((p) => ({ ...p, [s.id]: { ...p[s.id], games: Number(e.target.value), winner: p[s.id]?.winner ?? '' } }))}
                  className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
                >
                  {[4, 5, 6, 7].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="font-semibold">{t('bonus')}</h2>
        {([
          ['east_cf_team_a', t('east_cf')], ['east_cf_team_b', t('east_cf')],
          ['west_cf_team_a', t('west_cf')], ['west_cf_team_b', t('west_cf')],
          ['cup_finalist_east', t('cup_finalists') + ' (E)'],
          ['cup_finalist_west', t('cup_finalists') + ' (W)'],
          ['cup_winner', t('cup_winner')],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3">
            <span className="flex-1 text-sm">{label}</span>
            <input
              disabled={locked}
              value={bonusState[key]}
              onChange={(e) => setBonusState({ ...bonusState, [key]: e.target.value })}
              className="w-56 rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
            />
          </label>
        ))}
      </section>

      <button
        disabled={locked || saving}
        onClick={save}
        className="rounded bg-blue-600 px-4 py-2 font-medium disabled:opacity-50"
      >
        {t('save')}
      </button>
      {msg && <span className="ml-3 text-sm text-green-400">{msg}</span>}
    </div>
  );
}
