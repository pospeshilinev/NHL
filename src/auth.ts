import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const username = String(creds?.username ?? '').trim().toLowerCase();
        const password = String(creds?.password ?? '');
        if (!username || !password) return null;

        const { rows } = await pool.query(
          'select id, username, password_hash, display_name, role from users where username = $1',
          [username],
        );
        const u = rows[0];
        if (!u) return null;

        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return null;

        return {
          id: String(u.id),
          name: u.display_name ?? u.username,
          role: u.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = (token as any).id;
      (session.user as any).role = (token as any).role;
      return session;
    },
  },
  pages: { signIn: '/signin' },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user as { id: string; name?: string; role: string };
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'admin') throw new Error('FORBIDDEN');
  return u;
}
