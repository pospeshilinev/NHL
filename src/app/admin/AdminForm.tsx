'use client';
import { useState, useTransition } from 'react';

type Season = { id: string; year: number; picks_deadline: string } | null;

export default function AdminForm({ season, saveAction, syncAction }: {
  season: Season;
  saveAction: (i: { id?: string; year: number; picks_deadline: string }) => Promise<void>;
  syncAction: () => Promise<any>;
}) {
  const [year, setYear] = useState(season?.year ?? new Date().getFullYear());
  const [deadline, setDeadline] = useState(
    season?.picks_deadline ? new Date(season.picks_deadline).toISOString().slice(0, 16) : '',
  );
  const [msg, setMsg] = useState('');
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await saveAction({
          id: season?.id,
          year,
          picks_deadline: new Date(deadline).toISOString(),
        });
        setMsg('Сохранено ✓');
      } catch (e: any) { setMsg('Ошибка: ' + e.message); }
    });
  }
  function sync() {
    startTransition(async () => {
      try {
        const r = await syncAction();
        setMsg(`Синк OK: ${r?.series ?? 0} серий`);
      } catch (e: any) { setMsg('Ошибка: ' + e.message); }
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm">Сезон (год)</span>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm">Дедлайн (старт 1-го раунда)</span>
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
      </label>
      <div className="flex gap-2">
        <button onClick={save} disabled={pending || !deadline}
          className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50">Сохранить</button>
        <button onClick={sync} disabled={pending}
          className="rounded bg-neutral-700 px-4 py-2 disabled:opacity-50">Синк NHL API</button>
      </div>
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      <p className="text-xs text-neutral-500 pt-4">
        Сетка и результаты тянутся автоматически из api-web.nhle.com (см. cron-контейнер).
      </p>
    </div>
  );
}
