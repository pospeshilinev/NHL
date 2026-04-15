import NextAuth from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import PostgresAdapter from '@auth/pg-adapter';
import { pool } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  session: { strategy: 'database' },
  trustHost: true,
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        // false для STARTTLS на 587/25 (типично для Exchange), true для SMTPS на 465
        secure: process.env.EMAIL_SERVER_SECURE === 'true',
        requireTLS: process.env.EMAIL_SERVER_SECURE !== 'true',
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
        // Exchange нередко с самоподписанным сертом на внутреннем имени —
        // если столкнётесь с unable to verify, добавьте: tls: { rejectUnauthorized: false }
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: { signIn: '/signin' },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as any).id = user.id;
      return session;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user as { id: string; email: string; name?: string };
}

export async function requireAdmin() {
  const u = await requireUser();
  const r = await pool.query('select role from users where id = $1', [u.id]);
  if (r.rows[0]?.role !== 'admin') throw new Error('FORBIDDEN');
  return u;
}
