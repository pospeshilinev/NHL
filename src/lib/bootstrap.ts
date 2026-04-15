import bcrypt from 'bcryptjs';
import { pool } from './db';

// Вызывается один раз при старте сервера (через instrumentation.ts).
// Если заданы BOOTSTRAP_ADMIN_USERNAME + BOOTSTRAP_ADMIN_PASSWORD и такого
// пользователя ещё нет — создаёт его с ролью admin. Идемпотентно.
export async function bootstrapAdmin() {
  const username = (process.env.BOOTSTRAP_ADMIN_USERNAME ?? '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (!username || !password) {
    console.log('[bootstrap] BOOTSTRAP_ADMIN_USERNAME/PASSWORD не заданы — пропускаем');
    return;
  }

  try {
    const { rows } = await pool.query('select id from users where username = $1', [username]);
    if (rows.length) {
      console.log(`[bootstrap] admin "${username}" уже существует`);
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `insert into users (username, password_hash, display_name, role)
       values ($1, $2, $3, 'admin')`,
      [username, hash, username],
    );
    console.log(`[bootstrap] создан admin "${username}"`);
  } catch (e) {
    console.error('[bootstrap] ошибка:', e);
  }
}
