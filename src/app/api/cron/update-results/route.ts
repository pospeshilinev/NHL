import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Vercel cron hits this every 15 min. Pulls NHL playoff bracket and:
// 1) creates/updates series rows by series_letter (A..O)
// 2) fills team_high/team_low as bracket fills in
// 3) sets actual_winner / actual_games for decided series
// 4) recomputes bonus_results (CF participants, Cup finalists, champion)
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: season } = await supabase
    .from('seasons').select('*').eq('is_active', true).single();
  if (!season) return NextResponse.json({ ok: false, reason: 'no active season' });

  const res = await fetch(`https://api-web.nhle.com/v1/playoff-bracket/${season.year}`, {
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json({ ok: false, status: res.status });
  const bracket = await res.json();

  const rows: any[] = [];
  for (const s of bracket.series ?? []) {
    const games = (s.topSeedWins ?? 0) + (s.bottomSeedWins ?? 0);
    rows.push({
      season_id: season.id,
      round: s.playoffRound,
      conference: s.conferenceAbbrev ?? null, // null only for SCF
      slot: s.bracketLogic ?? s.seriesUrl ?? s.seriesLetter, // fallback chain
      series_letter: s.seriesLetter,
      team_high: s.topSeedTeam?.abbrev ?? null,
      team_low: s.bottomSeedTeam?.abbrev ?? null,
      starts_at: s.neutralVenue ? null : null,
      actual_winner: s.winningTeamAbbrev ?? null,
      actual_games: s.winningTeamAbbrev ? games : null,
    });
  }

  // Upsert by stable key (season_id, series_letter)
  const { error } = await supabase.from('series').upsert(rows, {
    onConflict: 'season_id,series_letter',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message });

  // ---- bonus_results ----
  // финалисты конференции = победители R2 (играют в CF), 2 на конференцию
  // участники финала Кубка = победители R3 (CF), 2 команды
  // чемпион = победитель R4 (SCF)
  const cfTeams: { E: string[]; W: string[] } = { E: [], W: [] };
  const cupFinalists: string[] = [];
  let cupWinner: string | null = null;

  for (const s of bracket.series ?? []) {
    if (!s.winningTeamAbbrev) continue;
    if (s.playoffRound === 2 && s.conferenceAbbrev) {
      cfTeams[s.conferenceAbbrev as 'E' | 'W'].push(s.winningTeamAbbrev);
    }
    if (s.playoffRound === 3) cupFinalists.push(s.winningTeamAbbrev);
    if (s.playoffRound === 4) cupWinner = s.winningTeamAbbrev;
  }

  await supabase.from('bonus_results').upsert({
    season_id: season.id,
    east_cf_teams: cfTeams.E,
    west_cf_teams: cfTeams.W,
    cup_finalists: cupFinalists,
    cup_winner: cupWinner,
  });

  return NextResponse.json({
    ok: true,
    series: rows.length,
    cfTeams,
    cupFinalists,
    cupWinner,
  });
}
