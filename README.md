# NHL Playoff Picks

Небольшой сайт прогнозов плей-офф NHL. RU/EN, magic-link авторизация, автообновление результатов из NHL API.

## Стек
- **Next.js 14** (App Router, standalone build)
- **PostgreSQL 16**
- **Auth.js v5** + Nodemailer (magic link через ваш SMTP)
- **Docker Compose** — postgres + app + cron, app публикует порт 3000 на хосте
- **next-intl** — RU/EN

## Правила подсчёта
- Серия: точный счёт **3**, только победитель **1**, мимо **0**
- Финалисты конференций (4 команды, по 2 на конференцию): **5** за каждого = до 20
- Участники финала Кубка Стэнли (2 команды): **7** за каждого = до 14
- Чемпион: **10**
- **Максимум бонусов: 44**

Все 15 серий + 7 бонусных пиков заполняются одной формой **до старта 1-го раунда**. После дедлайна форма закрывается, чужие пики становятся видны.

## Деплой на свой VPS

### Требования
- Ubuntu 22.04/24.04 (или Debian)
- 2+ ГБ RAM, 1+ vCPU, 20+ ГБ диска
- Свободный TCP-порт 3000 на хосте (или поменяйте маппинг в `docker-compose.yml`)
- IP сервера в локальной сети либо DNS-имя
- Доступ к SMTP-серверу Exchange (хост, порт, учётка, пароль)

### Шаги

1. **Установить Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Склонировать репозиторий:**
   ```bash
   git clone https://github.com/pospeshilinev/NHL.git
   cd NHL
   ```

3. **Создать `.env`:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Сгенерировать `AUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

4. **В `.env` указать `AUTH_URL`** — ровно тот URL, по которому будут открывать сайт:
   ```
   AUTH_URL=http://10.185.22.10:3000
   AUTH_TRUST_HOST=true
   ```
   (или DNS-имя, например `http://nhl.local:3000`).

5. **Запустить контейнеры:**
   ```bash
   docker compose up -d --build
   ```
   Приложение доступно на `http://<ip-сервера>:3000` со всей локальной сети.
   Если есть firewall:
   ```bash
   sudo ufw allow from 10.185.22.0/24 to any port 3000
   ```

6. **Открыть сайт** в браузере → `/signin` → ввести email → перейти по magic link из письма.

7. **Назначить себя админом:**
   ```bash
   docker compose exec postgres psql -U nhl -d nhl \
     -c "update users set role='admin' where email='you@example.com';"
   ```

8. **Зайти в `/admin`**, ввести год и дедлайн, нажать **Синк NHL API**.

### Обновление
```bash
git pull
docker compose up -d --build
```

### Бэкап БД
```bash
docker compose exec postgres pg_dump -U nhl nhl | gzip > backup-$(date +%F).sql.gz
```

## Частые проблемы

### `WARN The "xxx" variable is not set. Defaulting to a blank string.`
Ваш `.env` содержит символ `$` в значении (обычно в пароле) — docker compose интерпретирует `$VAR` как ссылку на переменную. Два варианта:

- **Экранировать** удвоением: `PASSWORD=my$$secret`
- **Сгенерировать пароль без `$`**: `openssl rand -hex 24`

Строка `DATABASE_URL` должна содержать тот же пароль, что и `POSTGRES_PASSWORD`.

### `AggregateError [ECONNREFUSED] ::1:5432` на этапе `npm run build`
Next.js во время сборки пытается пререндерить страницы и натыкается на запросы к БД, которой при билде ещё нет. Должно быть исправлено флагом `export const dynamic = 'force-dynamic'` в `src/app/layout.tsx`. Если всё-таки ловите — убедитесь, что сделан `git pull` с последним коммитом.

### `failed to compute cache key: "/app/public": not found`
В репо должна быть папка `public/` (хотя бы пустая с `.gitkeep`). Если удалили случайно:
```bash
mkdir -p public && touch public/.gitkeep
```

### Magic link не приходит
```bash
docker compose logs app | grep -i -E "nodemailer|smtp|email"
```
Типовые причины:
- неверный `EMAIL_SERVER_PORT` / `EMAIL_SERVER_SECURE` (для Exchange обычно 587 + `false`)
- Exchange не разрешает authenticated SMTP с IP сервера (receive connector)
- `EMAIL_FROM` с доменом, который Exchange не обслуживает → relay denied
- самоподписанный сертификат на Exchange — добавьте в `src/auth.ts` в объект `server`: `tls: { rejectUnauthorized: false }`

### Ошибка `AuthJS: missing URL` или редирект на неправильный хост
`AUTH_URL` в `.env` должен **буква-в-букву** совпадать с тем, что пользователи вбивают в браузере (схема + хост + порт):
```
AUTH_URL=http://10.185.22.36:3000
```

### Порт 3000 уже занят на хосте
Поменяйте левую часть маппинга в `docker-compose.yml`:
```yaml
ports:
  - "3100:3000"
```
И синхронно обновите `AUTH_URL=http://<ip>:3100`.

## Структура
```
src/app/            — страницы (home, signin, picks, leaderboard, admin)
src/auth.ts         — Auth.js конфиг
src/lib/db.ts       — pg pool
src/lib/nhl-sync.ts — синк с api-web.nhle.com
db/schema.sql       — схема Postgres (применяется при первом старте контейнера)
docker-compose.yml  — postgres + app + cron
```
