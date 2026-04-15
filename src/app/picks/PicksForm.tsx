'use client';
import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { SavePicksInput } from './actions';

type Series = {
  id: string;
  round: number;
  conference: 'E' | 'W' | null;
  slot: number;
  series_letter: string;
  team_high: string | null;
  team_low: string | null;
};
type Pick = { series_id: string; winner: string; games: number };
type Bonus = SavePicksInput['bonus'];

// NHL bracket (no reseeding): round-1 letters A..H, round-2 I..L, CF M..N, SCF O.
const PARENTS: Record<string, [string, string]> = {
  I: ['A', 'B'], J: ['C', 'D'], K: ['E', 'F'], L: ['G', 'H'],
  M: ['I', 'J'], N: ['K', 'L'],
  O: ['M', 'N'],
};
const CHILD_OF: Record<string, string> = {};
for (const [child, [a, b]] of Object.entries(PARENTS)) {
  CHILD_OF[a] = child;
  CHILD_OF[b] = child;
}

export default function PicksForm({ season, series, picks, bonus, locked, action }: {
  season: { id: string; picks_deadline: string };
  series: Series[];
  picks: Pick[];
  bonus: Bonus | null;
  locked: boolean;
  action: (input: SavePicksInput) => Promise<void>;
}) {
  const t = useTranslations('picks');
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<Record<string, { winner: string; games: number }>>(
    Object.fromEntries(picks.map((p) => [p.series_id, { winner: p.winner, games: p.games }])),
  );
  const [bonusState, setBonusState] = useState<Bonus>(bonus ?? {
    east_cf_team_a: '', east_cf_team_b: '', west_cf_team_a: '', west_cf_team_b: '',
    cup_finalist_east: '', cup_finalist_west: '', cup_winner: '',
  });
  const [msg, setMsg] = useState('');

  const byLetter = useMemo(
    () => new Map(series.map((s) => [s.series_letter, s])),
    [series],
  );

  const { east, west, all } = useMemo(() => {
    const e: string[] = [];
    const w: string[] = [];
    for (const s of series) {
      if (s.round !== 1) continue;
      const bucket = s.conference === 'W' ? w : e;
      if (s.team_high) bucket.push(s.team_high);
      if (s.team_low) bucket.push(s.team_low);
    }
    return { east: e, west: w, all: [...e, ...w] };
  }, [series]);

  function optionsFor(s: Series): string[] {
    if (s.round === 1) {
      return [s.team_high, s.team_low].filter((x): x is string => !!x);
    }
    const parents = PARENTS[s.series_letter];
    if (!parents) return [];
    return parents
      .map((letter) => byLetter.get(letter))
      .map((p) => (p ? state[p.id]?.winner ?? '' : ''))
      .filter((x): x is string => !!x);
  }

  function setWinner(s: Series, newWinner: string) {
    setState((prev) => {
      const next = { ...prev };
      const oldWinner = prev[s.id]?.winner ?? '';
      next[s.id] = { winner: newWinner, games: prev[s.id]?.games ?? 4 };
      // Cascade clear: any descendant whose winner equals the old team is now invalid.
      if (oldWinner && oldWinner !== newWinner) {
        let letter = s.series_letter;
        while (CHILD_OF[letter]) {
          letter = CHILD_OF[letter];
          const ds = byLetter.get(letter);
          if (!ds) break;
          if (next[ds.id]?.winner === oldWinner) {
            next[ds.id] = { winner: '', games: next[ds.id].games };
          } else {
            break;
          }
        }
      }
      return next;
    });
  }

  function setGames(s: Series, games: number) {
    setState((prev) => ({
      ...prev,
      [s.id]: { winner: prev[s.id]?.winner ?? '', games },
    }));
  }

  function save() {
    startTransition(async () => {
      try {
        const validPicks = series
          .map((s) => {
            const cur = state[s.id];
            if (!cur?.winner) return null;
            const opts = optionsFor(s);
            if (!opts.includes(cur.winner)) return null;
            return { seriesId: s.id, winner: cur.winner, games: cur.games || 4 };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        await action({ seasonId: season.id, picks: validPicks, bonus: bonusState });
        setMsg('✓');
      } catch (e: any) {
        setMsg(`Ошибка: ${e.message}`);
      }
    });
  }

  const byRound = (r: number) => series.filter((s) => s.round === r);

  function SeriesRow({ s }: { s: Series }) {
    const opts = optionsFor(s);
    const currentRaw = state[s.id]?.winner ?? '';
    const current = opts.includes(currentRaw) ? currentRaw : '';
    const label =
      s.round === 1
        ? `${s.team_high ?? '—'} vs ${s.team_low ?? '—'}`
        : opts.length === 2
          ? `${opts[0]} vs ${opts[1]}`
          : opts.length === 1
            ? `${opts[0]} vs ?`
            : '? vs ?';

    return (
      <div className="flex items-center gap-3 rounded border border-neutral-800 p-3">
        <div className="flex-1 text-sm">{label}</div>
        <select
          disabled={locked || opts.length === 0}
          value={current}
          onChange={(e) => setWinner(s, e.target.value)}
          className="w-40 rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {opts.map((team) => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>
        <select
          disabled={locked}
          value={state[s.id]?.games ?? 4}
          onChange={(e) => setGames(s, Number(e.target.value))}
          className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
        >
          {[4, 5, 6, 7].map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
    );
  }

  function BonusSelect({
    label,
    field,
    options,
  }: { label: string; field: keyof Bonus; options: string[] }) {
    return (
      <label className="flex items-center gap-3">
        <span className="flex-1 text-sm">{label}</span>
        <select
          disabled={locked || options.length === 0}
          value={bonusState[field]}
          onChange={(e) => setBonusState({ ...bonusState, [field]: e.target.value })}
          className="w-56 rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {options.map((team) => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>
      </label>
    );
  }

  const eastCfOptsA = east.filter((x) => x !== bonusState.east_cf_team_b);
  const eastCfOptsB = east.filter((x) => x !== bonusState.east_cf_team_a);
  const westCfOptsA = west.filter((x) => x !== bonusState.west_cf_team_b);
  const westCfOptsB = west.filter((x) => x !== bonusState.west_cf_team_a);

  return (
    <div className="space-y-8">
      {locked && <div className="rounded bg-yellow-900/40 p-3">{t('locked')}</div>}

      {[1, 2, 3, 4].map((r) => (
        <section key={r}>
          <h2 className="font-semibold mb-3">
            {r === 1 ? t('round1') : r === 2 ? t('round2') : r === 3 ? t('cf') : t('scf')}
          </h2>
          <div className="space-y-2">
            {byRound(r).map((s) => <SeriesRow key={s.id} s={s} />)}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="font-semibold">{t('bonus')}</h2>
        <BonusSelect label={t('east_cf')} field="east_cf_team_a" options={eastCfOptsA} />
        <BonusSelect label={t('east_cf')} field="east_cf_team_b" options={eastCfOptsB} />
        <BonusSelect label={t('west_cf')} field="west_cf_team_a" options={westCfOptsA} />
        <BonusSelect label={t('west_cf')} field="west_cf_team_b" options={westCfOptsB} />
        <BonusSelect label={t('cup_finalists') + ' (E)'} field="cup_finalist_east" options={east} />
        <BonusSelect label={t('cup_finalists') + ' (W)'} field="cup_finalist_west" options={west} />
        <BonusSelect label={t('cup_winner')} field="cup_winner" options={all} />
      </section>

      <button
        disabled={locked || pending}
        onClick={save}
        className="rounded bg-blue-600 px-4 py-2 font-medium disabled:opacity-50"
      >
        {t('save')}
      </button>
      {msg && <span className="ml-3 text-sm text-green-400">{msg}</span>}
    </div>
  );
}
