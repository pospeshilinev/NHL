'use client';
import { useState, useTransition } from 'react';

type User = { id: number; username: string; display_name: string | null; role: string };

export default function UsersSection({
  users, currentUserId, createAction, resetAction, deleteAction,
}: {
  users: User[];
  currentUserId: number;
  createAction: (i: { username: string; password: string; display_name?: string; role: 'player' | 'admin' }) => Promise<void>;
  resetAction: (i: { userId: number; password: string }) => Promise<void>;
  deleteAction: (i: { userId: number }) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'player' as 'player' | 'admin' });

  function create() {
    startTransition(async () => {
      setMsg('');
      try {
        await createAction(form);
        setForm({ username: '', password: '', display_name: '', role: 'player' });
        setMsg('Создан ✓');
      } catch (e: any) { setMsg('Ошибка: ' + e.message); }
    });
  }

  function reset(userId: number) {
    const password = prompt('Новый пароль (минимум 6 символов):');
    if (!password) return;
    startTransition(async () => {
      try { await resetAction({ userId, password }); setMsg('Пароль сброшен ✓'); }
      catch (e: any) { setMsg('Ошибка: ' + e.message); }
    });
  }

  function remove(userId: number, username: string) {
    if (!confirm(`Удалить пользователя ${username}? Все его пики тоже удалятся.`)) return;
    startTransition(async () => {
      try { await deleteAction({ userId }); setMsg('Удалён ✓'); }
      catch (e: any) { setMsg('Ошибка: ' + e.message); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-neutral-800 p-4 space-y-3">
        <h3 className="font-semibold">Создать пользователя</h3>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Логин" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-sm" />
          <input placeholder="Имя (display name)" value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-sm" />
          <input placeholder="Пароль (≥6)" type="text" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-sm" />
          <select value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'player' | 'admin' })}
            className="rounded bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-sm">
            <option value="player">player</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button onClick={create} disabled={pending || !form.username || !form.password}
          className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">Создать</button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr><th>ID</th><th>Логин</th><th>Имя</th><th>Роль</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-neutral-800">
              <td className="py-2">{u.id}</td>
              <td>{u.username}</td>
              <td>{u.display_name}</td>
              <td>{u.role}</td>
              <td className="text-right space-x-2">
                <button onClick={() => reset(u.id)} disabled={pending}
                  className="text-xs text-blue-400 hover:underline">сменить пароль</button>
                {u.id !== currentUserId && (
                  <button onClick={() => remove(u.id, u.username)} disabled={pending}
                    className="text-xs text-red-400 hover:underline">удалить</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {msg && <p className="text-sm text-green-400">{msg}</p>}
    </div>
  );
}
