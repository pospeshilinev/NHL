'use server';
import { requireUser } from '@/auth';
import { pool } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export type SavePicksInput = {
  seasonId: string;
  picks: { seriesId: string; winner: string; games: number }[];
  bonus: {
    east_cf_team_a: string;
    east_cf_team_b: string;
    west_cf_team_a: string;
    west_cf_team_b: string;
    cup_finalist_east: string;
    cup_finalist_west: string;
    cup_winner: string;
  };
};

export async function savePicks(input: SavePicksInput) {
  const user = await requireUser();
  const userId = Number(user.id);

  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: seasonRows } = await client.query(
      'select picks_deadline from seasons where id = $1',
      [input.seasonId],
    );
    const season = seasonRows[0];
    if (!season) throw new Error('SEASON_NOT_FOUND');
    if (new Date(season.picks_deadline) < new Date()) {
      throw new Error('PICKS_LOCKED');
    }

    for (const p of input.picks) {
      if (!p.winner) continue;
      await client.query(
        `insert into picks (user_id, series_id, winner, games)
         values ($1, $2, $3, $4)
         on conflict (user_id, series_id)
         do update set winner = excluded.winner, games = excluded.games, updated_at = now()`,
        [userId, p.seriesId, p.winner, p.games],
      );
    }

    const b = input.bonus;
    await client.query(
      `insert into bonus_picks (
         user_id, season_id,
         east_cf_team_a, east_cf_team_b, west_cf_team_a, west_cf_team_b,
         cup_finalist_east, cup_finalist_west, cup_winner
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (user_id, season_id) do update set
         east_cf_team_a = excluded.east_cf_team_a,
         east_cf_team_b = excluded.east_cf_team_b,
         west_cf_team_a = excluded.west_cf_team_a,
         west_cf_team_b = excluded.west_cf_team_b,
         cup_finalist_east = excluded.cup_finalist_east,
         cup_finalist_west = excluded.cup_finalist_west,
         cup_winner = excluded.cup_winner,
         updated_at = now()`,
      [
        userId, input.seasonId,
        b.east_cf_team_a, b.east_cf_team_b, b.west_cf_team_a, b.west_cf_team_b,
        b.cup_finalist_east, b.cup_finalist_west, b.cup_winner,
      ],
    );

    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  revalidatePath('/picks');
}
