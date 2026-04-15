import { pool } from './db';

// Fixed NHL bracket (no reseeding): letter → {round, conference}.
// A..D East R1, E..H West R1, I..J East R2, K..L West R2, M East CF, N West CF, O SCF.
const BRACKET: Record<string, { round: number; conference: 'E' | 'W' | null }> = {
  A: { round: 1, conference: 'E' }, B: { round: 1, conference: 'E' },
  C: { round: 1, conference: 'E' }, D: { round: 1, conference: 'E' },
  E: { round: 1, conference: 'W' }, F: { round: 1, conference: 'W' },
  G: { round: 1, conference: 'W' }, H: { round: 1, conference: 'W' },
  I: { round: 2, conference: 'E' }, J: { round: 2, conference: 'E' },
  K: { round: 2, conference: 'W' }, L: { round: 2, conference: 'W' },
  M: { round: 3, conference: 'E' },
  N: { round: 3, conference: 'W' },
  O: { round: 4, conference: null },
};

// Тянет официальную сетку плей-офф из публичного NHL API и обновляет:
// - series (по series_letter)
// - bonus_results (полуфиналисты конференций, финалисты Кубка, чемпион)
export async function syncFromNhl() {
  const { rows: seasonRows } = await pool.query(
    'select * from seasons where is_active = true limit 1',
  );
  const season = seasonRows[0];
  if (!season) return { ok: false, reason: 'no active season' };

  const seasonCode = process.env.NHL_SEASON ?? `${season.year}`;
  const res = await fetch(`https://api-web.nhle.com/v1/playoff-bracket/${seasonCode}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, status: res.status };
  const bracket = (await res.json()) as any;

  const seriesList: any[] = bracket.series ?? [];

  for (const s of seriesList) {
    const letter = typeof s.seriesLetter === 'string' ? s.seriesLetter.toUpperCase() : '';
    const meta = BRACKET[letter];
    if (!meta) continue;
    const games = (s.topSeedWins ?? 0) + (s.bottomSeedWins ?? 0);
    const slot = letter.charCodeAt(0) - 64;
    await pool.query(
      `insert into series (
         season_id, round, conference, slot, series_letter,
         team_high, team_low, actual_winner, actual_games
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (season_id, series_letter) do update set
         round = excluded.round,
         conference = excluded.conference,
         slot = excluded.slot,
         team_high = coalesce(excluded.team_high, series.team_high),
         team_low = coalesce(excluded.team_low, series.team_low),
         actual_winner = excluded.actual_winner,
         actual_games = excluded.actual_games`,
      [
        season.id,
        meta.round,
        meta.conference,
        slot,
        letter,
        s.topSeedTeam?.abbrev ?? null,
        s.bottomSeedTeam?.abbrev ?? null,
        s.winningTeamAbbrev ?? null,
        s.winningTeamAbbrev ? games : null,
      ],
    );
  }

  // bonus_results — роль серии определяем по букве, а не по полю API.
  const cf: { E: string[]; W: string[] } = { E: [], W: [] };
  const cupFinalists: string[] = [];
  let cupWinner: string | null = null;
  for (const s of seriesList) {
    if (!s.winningTeamAbbrev) continue;
    const letter = typeof s.seriesLetter === 'string' ? s.seriesLetter.toUpperCase() : '';
    const meta = BRACKET[letter];
    if (!meta) continue;
    if (meta.round === 2 && meta.conference) {
      cf[meta.conference].push(s.winningTeamAbbrev);
    }
    if (meta.round === 3) cupFinalists.push(s.winningTeamAbbrev);
    if (meta.round === 4) cupWinner = s.winningTeamAbbrev;
  }

  await pool.query(
    `insert into bonus_results (season_id, east_cf_teams, west_cf_teams, cup_finalists, cup_winner)
     values ($1,$2,$3,$4,$5)
     on conflict (season_id) do update set
       east_cf_teams = excluded.east_cf_teams,
       west_cf_teams = excluded.west_cf_teams,
       cup_finalists = excluded.cup_finalists,
       cup_winner = excluded.cup_winner`,
    [season.id, cf.E, cf.W, cupFinalists, cupWinner],
  );

  return { ok: true, series: seriesList.length, cf, cupFinalists, cupWinner };
}
