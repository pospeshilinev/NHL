'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Season = { id: string; year: number; picks_deadline: string; is_active: boolean } | null;

export default function AdminForm({ season }: { season: Season }) {
  const supabase = createClient();
  const [year, setYear] = useState(season?.year ?? new Date().getFullYear());
  // datetime-local нужен формат "YYYY-MM-DDTHH:mm"
  const [deadline, setDeadline] = useState(
    season?.picks_deadline ? new Date(season.picks_deadline).toISOString().slice(0, 16) : '',
  );
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg('');
    const payload = {
      year,
      picks_deadline: new Date(deadline).toISOString(),
      is_active: true,
    };
    const { error } = season
      ? await supabase.from('seasons').update(payload).eq('id', season.id)
      : await supabase.from('seasons').insert(payload);
    setMsg(error ? `Ошибка: ${error.message}` : 'Сохранено ✓');
    setBusy(false);
  }

  async function syncNow() {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/cron/update-results', {
      headers: { authorization: `Bearer ${prompt('CRON_SECRET') ?? ''}` },
    });
    const j = await res.json();
    setMsg(j.ok ? `Синк OK: ${j.series} серий` : `Ошибка: ${JSON.stringify(j)}`);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm">Сезон (год)</span>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Дедлайн приёма прогнозов (старт 1-го раунда)</span>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
        />
      </label>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !deadline}
          className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          Сохранить
        </button>
        <button
          onClick={syncNow}
          disabled={busy}
          className="rounded bg-neutral-700 px-4 py-2 disabled:opacity-50"
        >
          Синхронизировать с NHL API сейчас
        </button>
      </div>

      {msg && <p className="text-sm text-green-400">{msg}</p>}

      <p className="text-xs text-neutral-500 pt-4">
        Сетка, результаты серий и бонусные итоги тянутся автоматически из
        api-web.nhle.com каждые 15 минут. Кнопка выше нужна только для ручного запуска.
      </p>
    </div>
  );
}
