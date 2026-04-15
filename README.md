# NHL Playoff Picks

Небольшой сайт для прогнозов плей-офф NHL. RU/EN, magic-link авторизация, автообновление результатов из NHL API.

## Стек
- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** — Postgres, Auth (magic link), RLS
- **Vercel** — хостинг + крон
- **next-intl** — RU/EN

## Правила подсчёта
- Серия: точный счёт — **3**, только победитель — **1**, мимо — **0**
- 4 полуфиналиста (финалисты конференций): **5** за каждого = до 20
- 2 участника финала Кубка Стэнли: **7** за каждого = до 14
- Чемпион: **10**
- **Максимум бонусов: 44**

Все 15 серий и 7 бонусных пиков вводятся одной формой **до старта 1-го раунда**. После дедлайна форма закрывается и становятся видны чужие пики.

## Быстрый старт

### 1. Supabase
1. Создайте проект на https://supabase.com
2. В SQL Editor выполните `supabase/schema.sql`
3. Auth → Providers → включите Email (magic link)
4. Скопируйте `Project URL` и `anon key` → в `.env.local`
5. Скопируйте `service_role key` → в `.env.local` (только для серверных крон-задач)

### 2. Локально
```bash
npm install
cp .env.example .env.local   # заполнить ключами Supabase
npm run dev
```

### 3. Vercel + свой домен
1. Залить репозиторий в GitHub
2. На https://vercel.com → New Project → импортировать репозиторий
3. Добавить переменные окружения из `.env.local` в Project Settings → Environment Variables
4. **Свой домен:** Project Settings → Domains → Add → ввести `picks.example.com` (или любой, что купили)
5. Vercel покажет DNS-записи (CNAME или A) — прописать их у регистратора домена
6. Через 5–30 минут HTTPS-сертификат выпустится автоматически

### 4. Крон обновления результатов
`vercel.json` уже настроен — каждые 15 минут дергает `/api/cron/update-results`, который ходит в `api-web.nhle.com` и обновляет `actual_winner`/`actual_games`.

## Администрирование
- Первый зарегистрированный пользователь в таблице `users` с `role='admin'` (поставить вручную в Supabase)
- Админ задаёт `season.picks_deadline` и начальную сетку 1-го раунда на странице `/admin`
