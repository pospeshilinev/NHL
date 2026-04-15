'use server';
import bcrypt from 'bcryptjs';
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

export async function createUser(input: {
  username: string;
  password: string;
  display_name?: string;
  role: 'player' | 'admin';
}) {
  await requireAdmin();
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password) throw new Error('EMPTY_FIELDS');
  if (input.password.length < 6) throw new Error('PASSWORD_TOO_SHORT');
  const hash = await bcrypt.hash(input.password, 10);
  try {
    await pool.query(
      `insert into users (username, password_hash, display_name, role)
       values ($1, $2, $3, $4)`,
      [username, hash, input.display_name || username, input.role],
    );
  } catch (e: any) {
    if (e.code === '23505') throw new Error('USERNAME_TAKEN');
    throw e;
  }
  revalidatePath('/admin');
}

export async function resetUserPassword(input: { userId: number; password: string }) {
  await requireAdmin();
  if (input.password.length < 6) throw new Error('PASSWORD_TOO_SHORT');
  const hash = await bcrypt.hash(input.password, 10);
  await pool.query('update users set password_hash = $1 where id = $2', [hash, input.userId]);
  revalidatePath('/admin');
}

export async function deleteUser(input: { userId: number }) {
  const me = await requireAdmin();
  if (Number(me.id) === input.userId) throw new Error('CANT_DELETE_SELF');
  await pool.query('delete from users where id = $1', [input.userId]);
  revalidatePath('/admin');
}
