'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await signIn('nodemailer', { email, redirect: false });
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-12">
      {sent ? (
        <p>{t('linkSent')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm">{t('emailLabel')}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
            />
          </label>
          <button className="w-full rounded bg-blue-600 px-3 py-2 font-medium">
            {t('sendLink')}
          </button>
        </form>
      )}
    </main>
  );
}
