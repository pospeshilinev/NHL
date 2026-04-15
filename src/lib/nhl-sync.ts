import { pool } from './db';

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
    const games = (s.topSeedWins ?? 0) + (s.bottomSeedWins ?? 0);
    const slot = typeof s.seriesLetter === 'string' && s.seriesLetter.length
      ? s.seriesLetter.toUpperCase().charCodeAt(0) - 64
      : 0;
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
        s.playoffRound,
        s.conferenceAbbrev ?? null,
        slot,
        s.seriesLetter,
        s.topSeedTeam?.abbrev ?? null,
        s.bottomSeedTeam?.abbrev ?? null,
        s.winningTeamAbbrev ?? null,
        s.winningTeamAbbrev ? games : null,
      ],
    );
  }

  // bonus_results
  const cf: { E: string[]; W: string[] } = { E: [], W: [] };
  const cupFinalists: string[] = [];
  let cupWinner: string | null = null;
  for (const s of seriesList) {
    if (!s.winningTeamAbbrev) continue;
    if (s.playoffRound === 2 && s.conferenceAbbrev) {
      cf[s.conferenceAbbrev as 'E' | 'W'].push(s.winningTeamAbbrev);
    }
    if (s.playoffRound === 3) cupFinalists.push(s.winningTeamAbbrev);
    if (s.playoffRound === 4) cupWinner = s.winningTeamAbbrev;
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
