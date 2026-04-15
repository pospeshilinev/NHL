'use server';
import { requireAdmin } from '@/auth';
import { pool } from '@/lib/db';
import { syncFromNhl } from '@/lib/nhl-sync';
import { revalidatePath } from 'next/cache';

export async function saveSeason(input: { id?: string; year: number; picks_deadline: string }) {
  await requireAdmin();
  if (input.id) {
    await pool.query(
      'update seasons set year = $1, picks_deadline = $2, is_active = true where id = $3',
      [input.year, input.picks_deadline, input.id],
    );
  } else {
    await pool.query(
      'insert into seasons (year, picks_deadline, is_active) values ($1, $2, true)',
      [input.year, input.picks_deadline],
    );
  }
  revalidatePath('/admin');
  revalidatePath('/picks');
}

export async function runSync() {
  await requireAdmin();
  return syncFromNhl();
}
