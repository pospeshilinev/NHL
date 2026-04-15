# NHL Playoff Picks

Небольшой сайт прогнозов плей-офф NHL. RU, авторизация по логин/паролю (аккаунты создаёт админ), автообновление результатов из NHL API.

## Стек
- **Next.js 14** (App Router, standalone build)
- **PostgreSQL 16**
- **Auth.js v5** + Credentials + bcryptjs (username/password, JWT-сессии)
- **Docker Compose** — postgres + app + cron

## Правила подсчёта
- Серия: точный счёт **3**, только победитель **1**, мимо **0**
- Финалисты конференций (4 команды): **5** за каждого = до 20
- Участники финала Кубка Стэнли (2 команды): **7** за каждого = до 14
- Чемпион: **10**
- **Максимум бонусов: 44**

Все 15 серий + 7 бонусных пиков заполняются одной формой **до старта 1-го раунда**. После дедлайна форма закрывается.

## Деплой

### Требования
- Ubuntu 22.04/24.04 или Debian
- 2+ ГБ RAM, 1+ vCPU
- Свободный TCP-порт 3000 (или поменять маппинг в `docker-compose.yml`)
- Docker с плагином `compose`

### Шаги

1. **Установить Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Склонировать:**
   ```bash
   git clone https://github.com/pospeshilinev/NHL.git
   cd NHL
   ```

3. **Создать `.env`:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Заполнить:
   - `POSTGRES_PASSWORD` + тот же пароль в `DATABASE_URL` (избегайте символа `$`)
   - `AUTH_SECRET` — сгенерировать: `openssl rand -base64 32`
   - `AUTH_URL` — точно тот URL, по которому открывают сайт, например `http://10.185.22.36:3000`
   - `BOOTSTRAP_ADMIN_USERNAME` + `BOOTSTRAP_ADMIN_PASSWORD` — учётка первого админа, создастся автоматически при первом запуске
   - `CRON_SECRET` — `openssl rand -hex 32`
   - `NHL_SEASON` — например `20252026`

4. **Запустить:**
   ```bash
   docker compose up -d --build
   docker compose logs app | grep bootstrap
   ```
   В логе должно быть `[bootstrap] создан admin "<имя>"`.

5. **Войти** на `http://<ip>:3000/signin` с учёткой из env.

6. **Зайти в `/admin`:**
   - Задать год сезона и дедлайн → Сохранить
   - Нажать **Синк NHL API** — подтянется сетка
   - В разделе «Пользователи» — создать аккаунты остальным участникам

7. После создания пользователей переменные `BOOTSTRAP_ADMIN_*` можно оставить (идемпотентно) или убрать из `.env`.

### Обновление
```bash
git pull && docker compose up -d --build
```

### Смена пароля админа
Через UI `/admin` → «Пользователи» → «сменить пароль». Или:
```bash
docker compose exec postgres psql -U nhl -d nhl \
  -c "delete from users where username='admin';"
# потом BOOTSTRAP_ADMIN_PASSWORD в .env → docker compose up -d
```

### Бэкап БД
```bash
docker compose exec postgres pg_dump -U nhl nhl | gzip > backup-$(date +%F).sql.gz
```

### ⚠️ Миграция со старой схемы (email/magic link → username/password)
Если БД уже была создана предыдущей версией, структура таблицы `users` несовместима. Сбросьте данные:
```bash
docker compose down
docker volume rm nhl_pgdata
docker compose up -d --build
```

## Частые проблемы

### `WARN The "xxx" variable is not set`
В `.env` значение содержит `$`. Экранируйте `$$` или сгенерируйте пароль без `$`: `openssl rand -hex 24`.

### `ECONNREFUSED ::1:5432` при билде
Должно быть исправлено `force-dynamic` в `layout.tsx`. Проверьте, что `git pull` подтянул последнее.

### `"/app/public": not found`
Создайте `mkdir -p public && touch public/.gitkeep`.

### Не удаётся войти
- Проверьте `docker compose logs app` — там видно попытки входа и ошибки.
- Убедитесь, что `AUTH_URL` в `.env` совпадает буква-в-букву с URL в браузере (схема + хост + порт).
- Если забыли пароль — смотри «Смена пароля админа» выше.

### Порт 3000 занят
```yaml
ports:
  - "3100:3000"
```
+ поменять `AUTH_URL` на `:3100`.

## Структура
```
src/app/            — страницы (home, signin, picks, leaderboard, admin)
src/auth.ts         — Auth.js + Credentials + bcryptjs
src/lib/db.ts       — pg pool
src/lib/bootstrap.ts — создание первого админа из env
src/lib/nhl-sync.ts — синк с api-web.nhle.com
src/instrumentation.ts — запускает bootstrap при старте сервера
db/schema.sql       — схема Postgres
docker-compose.yml  — postgres + app + cron
```
