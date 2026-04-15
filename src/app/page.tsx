import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function HomePage() {
  const t = useTranslations();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <h1 className="text-3xl font-bold">{t('home.title')}</h1>
      <p className="text-neutral-400">{t('home.subtitle')}</p>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="font-semibold mb-2">{t('home.rules')}</h2>
        <ul className="text-sm text-neutral-300 space-y-1">
          <li>• {t('scoring.exact')}</li>
          <li>• {t('scoring.winner')}</li>
          <li>• {t('scoring.miss')}</li>
          <li>• {t('scoring.semi')}</li>
          <li>• {t('scoring.final')}</li>
          <li>• {t('scoring.champ')}</li>
        </ul>
      </section>

      <nav className="flex gap-4">
        <Link className="underline" href="/picks">{t('nav.picks')}</Link>
        <Link className="underline" href="/leaderboard">{t('nav.leaderboard')}</Link>
        <Link className="underline" href="/signin">{t('nav.signIn')}</Link>
      </nav>
    </main>
  );
}
