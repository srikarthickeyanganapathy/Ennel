# ENNEL

Smart mess (hostel dining) booking platform: an Expo student app, a React admin dashboard and a NestJS API in one pnpm monorepo.

| Path              | What                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api`        | NestJS modular monolith (student API `/api/v1`, staff API `/api/v1/admin`), Prisma, BullMQ jobs |
| `apps/admin`      | React + Vite admin dashboard                                                                    |
| `apps/mobile`     | Expo (managed) student app                                                                      |
| `packages/shared` | `@ennel/shared`: enums, Zod schemas, permissions, error codes, theme tokens                     |
| `docs/`           | Spec, architecture, business rules, RBAC matrix, API contract, ADRs                             |

**New to the project? Read [docs/GUIDE.md](docs/GUIDE.md) first**: how the pieces connect, what works today, and how to debug.

For the design itself, see [docs/architecture.md](docs/architecture.md) and [docs/business-rules.md](docs/business-rules.md).

## Prerequisites

- Node.js 20.19+ (tested on 24) and pnpm 9 (`npm install -g pnpm@9`)
- Docker Desktop (on Windows it needs WSL 2) for local Postgres and Redis

## First run

```bash
pnpm install
cp .env.example .env        # then fill in secrets; never commit .env
pnpm db:up                  # Postgres 16 + Redis 7 (docker-compose.dev.yml)
pnpm build:shared
pnpm db:migrate             # apply Prisma migrations
pnpm db:seed                # roles, permissions, policy, meals + Breakfast slot, first Super Admin
pnpm db:seed:dev            # optional, local only: sample Lunch/Dinner slots, a demo hostel and a fictitious roster
```

In `.env`, set at least:

| Variable                                                        | How                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `JWT_STUDENT_SECRET`, `JWT_STAFF_SECRET`, `FILE_SIGNING_SECRET` | Different random strings, 32+ characters each                                                   |
| `TOTP_ENCRYPTION_KEY`                                           | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`                   |
| `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`           | The first Super Admin's sign-in. The password is temporary: it must be changed at first sign-in |

Both seeds are idempotent and never overwrite data staff have edited. Without `db:seed:dev`, the database has only the system data: create hostels, slots and the roster from the admin dashboard (Hostels, Mess configuration, Students → Import roster).

## Running everything

Use one terminal per command:

| Terminal | Command           | Result                                                                             |
| -------- | ----------------- | ---------------------------------------------------------------------------------- |
| 1        | `pnpm dev:shared` | Rebuilds `@ennel/shared` on change (the apps import its build)                     |
| 2        | `pnpm dev:api`    | API on http://localhost:3000, Swagger at http://localhost:3000/api/docs            |
| 3        | `pnpm dev:admin`  | Admin dashboard on http://localhost:5173 (proxies `/api` to the API)               |
| 4        | `pnpm dev:mobile` | Expo dev server; scan the QR code with Expo Go, or press `a` / `i` for an emulator |
| 5        | `pnpm dev:worker` | Background jobs (BullMQ): nightly Default Booking generation at 00:30 IST          |

Postgres and Redis must be up (`pnpm db:up`; stop them with `pnpm db:down`). If you change `packages/shared` while the API is running without `dev:shared`, run `pnpm build:shared` and restart the API.

### Admin dashboard

1. Open http://localhost:5173 and sign in with `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD` from `.env`.
2. You are sent to **Change password** first (12+ characters, not your email). After that the dashboard opens.
3. Add staff under **Staff & roles**. Each new account gets a temporary password, shown once, and must change it at first sign-in. Two-factor sign-in can be turned on per person under **Account**.

### Student app

Copy `apps/mobile/.env.example` to `apps/mobile/.env`. On an emulator, `EXPO_PUBLIC_API_URL=http://localhost:3000` works (Android emulator: `http://10.0.2.2:3000`). On a phone, use your computer's LAN address, for example `http://192.168.1.20:3000`; `localhost` on a phone is the phone itself. Students register with a reference number that exists in the roster (with `db:seed:dev`, the fictitious numbers `24900001`–`24900004`).

A student who forgot their password asks the mess office: staff issue a one-time reset code from the student's page in the admin dashboard, and the student enters it in the app.

## Checks

| Command                                      | Does                                                |
| -------------------------------------------- | --------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Checks for every package                            |
| `pnpm format`                                | Prettier                                            |
| `pnpm db:studio`                             | Browse the database tables at http://localhost:5555 |

API tests include integration tests against `TEST_DATABASE_URL`, so `pnpm db:up` must be running before `pnpm test`.

Commits follow Conventional Commits (enforced by commitlint); lint-staged runs on pre-commit.

Deployment is out of scope for the MVP.
