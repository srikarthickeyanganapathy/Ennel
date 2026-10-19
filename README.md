# ENNEL

Smart mess (hostel dining) booking platform: an Expo student app, a React admin dashboard and a NestJS API in one pnpm monorepo.

| Path              | What                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api`        | NestJS modular monolith (student API `/api/v1`, staff API `/api/v1/admin`), Prisma, BullMQ jobs |
| `apps/admin`      | React + Vite admin dashboard                                                                    |
| `apps/mobile`     | Expo (managed) student app                                                                      |
| `packages/shared` | `@ennel/shared`: enums, Zod schemas, permissions, error codes, theme tokens                     |
| `docs/`           | Spec, architecture, business rules, RBAC matrix, API contract, ADRs                             |

Start with [docs/architecture.md](docs/architecture.md) and [docs/business-rules.md](docs/business-rules.md).

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
pnpm db:seed                # roles, permissions, meals/slots, policy, dev roster, first Super Admin
```

The seed creates the first Super Admin from `SEED_SUPER_ADMIN_*` in `.env`. That account must change its password on first login.

## Daily commands

| Command                                      | Does                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev:shared`                            | Rebuild `@ennel/shared` on change (keep running alongside the apps) |
| `pnpm dev:api`                               | API on http://localhost:3000, Swagger at `/api/docs`                |
| `pnpm dev:admin`                             | Admin on http://localhost:5173 (proxies `/api` to the API)          |
| `pnpm dev:mobile`                            | Expo dev server                                                     |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Checks for every package                                            |
| `pnpm format`                                | Prettier                                                            |

Commits follow Conventional Commits (enforced by commitlint); lint-staged runs on pre-commit.

Deployment is out of scope for the MVP.
