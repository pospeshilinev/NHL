'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get('callbackUrl') ?? '/picks';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr('');
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setErr('Неверный логин или пароль');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Вход</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Логин</span>
          <input
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Пароль</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
          />
        </label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          disabled={pending}
          className="w-full rounded bg-blue-600 px-3 py-2 font-medium disabled:opacity-50"
        >
          {pending ? '…' : 'Войти'}
        </button>
      </form>
      <p className="text-xs text-neutral-500 mt-6">
        Учётные записи создаёт администратор.
      </p>
    </main>
  );
}
