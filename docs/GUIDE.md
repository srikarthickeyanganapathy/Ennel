# ENNEL: a beginner's guide to the code and to debugging

This guide explains how the project fits together, what works today, how to start it, and how to find out what is wrong when something does not work. Read it top to bottom once. After that, use section 6 ("Something is broken") as a checklist.

---

## 1. The big picture

ENNEL is **three programs that talk to each other**, plus a shared library and a database:

```
  Student's phone                     Staff's browser
 ┌──────────────────┐               ┌──────────────────┐
 │  apps/mobile     │               │  apps/admin      │
 │  (Expo / React   │               │  (React website, │
 │   Native app)    │               │   localhost:5173)│
 └────────┬─────────┘               └────────┬─────────┘
          │  HTTP requests (JSON)            │  HTTP requests (JSON)
          │  /api/v1/...                     │  /api/v1/admin/...
          ▼                                  ▼
        ┌──────────────────────────────────────┐
        │  apps/api   (NestJS server, :3000)   │  ← all rules and checks live here
        └───────────────┬──────────────────────┘
                        │ Prisma (database library)
                        ▼
        ┌──────────────────────────┐   ┌──────────────┐
        │ PostgreSQL (in Docker)   │   │ Redis        │ ← rate limits, later: job queue
        └──────────────────────────┘   └──────────────┘

  packages/shared  →  code used by all three: form rules (Zod schemas),
                      error codes, permission names, colours, time helpers
```

The key idea: **the phone app and the admin website never touch the database.** They only send requests to the API. The API checks everything (who you are, whether you are allowed, whether the data is valid) and then reads or writes the database.

So when "nothing works", the question is always: **which arrow is broken?**

1. The app cannot reach the API (network or address problem).
2. The API is reachable but refuses the request (it answers with an error code).
3. The API cannot reach the database (Docker is not running).

Section 6 shows how to tell which one it is.

---

## 2. What exists today, and what does not yet

The project is built in phases. Phases 0–6 are done. **Many screens you might expect are deliberately not built yet.** That is not a bug.

| Area                                                                                                                | Status                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Student: register with a reference number, log in                                                                   | ✅ Works (Phase 1)                                                                                |
| Student: first-time setup (profile, hostel, meals)                                                                  | ✅ Works (Phase 1)                                                                                |
| Student: reset password with a code from the office                                                                 | ✅ Works (Phase 2)                                                                                |
| Student: **slot availability** (Home → Check slot availability)                                                     | ✅ Works (Phase 3): live counts and labels; booking from it arrives in Phase 4                    |
| Student: **Home** (meals for a date, book, change slot, meal type, cancel, countdowns, Cancel Today's Meals)        | ✅ Works (Phase 4)                                                                                |
| Student: **Profile tab**                                                                                            | ⏳ Shows your name and Log Out. Viewing and editing your details (Spec §9) comes in a later phase |
| Student: **Default Booking tab** (overall switch, per-meal ON/OFF, edit one meal, Change Slots for all meals)       | ✅ Works (Phase 5): saving updates your upcoming bookings at once                                 |
| Student: **Plan Ahead** (Home → Plan Ahead: change one date, or weekday rules such as "Mon/Wed lunch at 1:00 PM")   | ✅ Works (Phase 6): a one-date change always wins over a weekday rule                             |
| Student: My Bookings, leave, no-shows, complaints                                                                   | ⏳ Phases 7–10                                                                                    |
| Admin: sign in, change password, 2FA, sessions                                                                      | ✅ Works (Phase 2)                                                                                |
| Admin: Staff & roles, Audit log                                                                                     | ✅ Works (Phase 2)                                                                                |
| Admin: Students, Import roster, reset codes                                                                         | ✅ Works (Phase 2)                                                                                |
| Admin: Mess configuration, Hostels, Policy, Menus                                                                   | ✅ Works (Phase 2)                                                                                |
| Admin: **Dashboard** (booked / expected / attended plates, slot occupancy, pending work, 7-day charts)              | ✅ Works (Phase 4)                                                                                |
| Admin: **Bookings** (grid, book for a student, move, cancel, correct status, bulk actions)                          | ✅ Works (Phase 4)                                                                                |
| Admin: **Closures** (close a date or meals, see how many bookings it cancels, remove a closure to restore bookings) | ✅ Works (Phase 5)                                                                                |
| Admin: attendance, leaves, no-shows, complaints, announcements, reports                                             | ⏳ Phases 6–11 (not in the sidebar yet)                                                           |

---

## 3. Starting everything (every day)

You need **these things running**. Use one terminal window for each `pnpm dev:*` command and leave them open.

| #   | What              | Command (run in the project folder) | How you know it works                                                        |
| --- | ----------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Docker Desktop    | open the Docker Desktop app         | its whale icon says "running"                                                |
| 2   | Database + Redis  | `pnpm db:up`                        | `docker ps` lists `ennel-dev-postgres-1` and `ennel-dev-redis-1`             |
| 3   | Shared library    | `pnpm dev:shared`                   | prints "Found 0 errors. Watching for file changes."                          |
| 4   | API               | `pnpm dev:api`                      | prints `API listening on port 3000`; http://localhost:3000 shows `ENNEL API` |
| 5   | Admin website     | `pnpm dev:admin`                    | http://localhost:5173 shows "ENNEL staff sign-in"                            |
| 6   | Student app       | `pnpm dev:mobile`                   | shows a QR code; the app prints `[ENNEL] API_URL = ...` when it opens        |
| 7   | Background worker | `pnpm dev:worker`                   | prints `Worker ready; generate-default-bookings runs daily at 00:30 IST`     |

The worker runs the nightly job that books the next days from everyone's Default Booking settings. Without it, bookings still appear when a student saves settings, but new days are not added each night.

**Order matters:** Docker before the API (the API needs the database), and the shared library before the apps (they import its compiled code).

Quick health check in a browser: http://localhost:3000/api/v1/health should show `{"status":"ok","database":"up",...}`.

- `database: "down"` → Docker or Postgres is not running (`pnpm db:up`).
- Page does not load at all → the API is not running, or it crashed (look at its terminal).

### Opening the student app on your phone

1. Install **Expo Go** from the Play Store / App Store, and **update it** if it is already installed. The project uses Expo SDK 58; an older Expo Go shows _"Project is incompatible with this version of Expo Go"_.
2. Phone and computer must be on the **same Wi-Fi**.
3. Scan the QR code from the `pnpm dev:mobile` terminal.
4. In that terminal, find the line `[ENNEL] API_URL = http://<your computer's address>:3000`. If it says `localhost` while you use a phone, see section 6.

### Opening the student app in a web browser (no phone needed)

Press **`w`** in the `pnpm dev:mobile` terminal. The app opens at http://localhost:8081 and talks to the API on the same computer. It's handy for quick checks, but the real app is the phone version:

- The web version forgets your sign-in when you reload the page (it keeps the login only in memory, because browsers have no secure keychain).
- The API accepts requests from any `localhost` page only while `NODE_ENV=development`. If you see a **CORS** error in the browser console (F12), the API is not in development mode or not running.

To test registration, use a reference number that exists in the roster: `24900001` to `24900004` if you ran `pnpm db:seed:dev`, or one you imported in the admin dashboard under Students → Import roster.

---

## 4. Follow one request through the code

The best way to understand the code is to follow **one action from the button to the database and back**. Here is student login. Open each file as you read.

**On the phone (apps/mobile):**

1. [app/(auth)/login.tsx](<../apps/mobile/app/(auth)/login.tsx>): the route. Expo Router turns each file in `app/` into a screen. This file only points at the real screen.
2. [src/features/auth/screens/LoginScreen.tsx](../apps/mobile/src/features/auth/screens/LoginScreen.tsx): what you see. The form checks the input with `loginRequestSchema` (from the shared library) **before** sending anything.
3. [src/features/auth/hooks/use-auth-mutations.ts](../apps/mobile/src/features/auth/hooks/use-auth-mutations.ts): `useLogin()` sends the request and, on success, stores the session.
4. [src/features/auth/api/auth-api.ts](../apps/mobile/src/features/auth/api/auth-api.ts): `loginStudent()` names the URL: `POST /api/v1/auth/login`.
5. [src/shared/api-client/api-client.ts](../apps/mobile/src/shared/api-client/api-client.ts): the one place that actually calls `fetch`. It adds the login token, turns API errors into `ApiError`, and turns "could not connect" into the message _"Cannot reach the ENNEL server at …"_.
6. [src/config/env.ts](../apps/mobile/src/config/env.ts): decides **which address** the API is at.

**On the server (apps/api):**

7. [src/modules/auth/controllers/student-auth.controller.ts](../apps/api/src/modules/auth/controllers/student-auth.controller.ts): `@Post('login')`. The controller validates the body with the **same** `loginRequestSchema`, then calls one service. Controllers contain no rules.
8. [src/modules/auth/services/login-student.service.ts](../apps/api/src/modules/auth/services/login-student.service.ts): the use case. It looks up the student, checks the lockout, verifies the password, and creates a session. Read this file; it is short.
9. [src/modules/auth/domain/login-lockout.ts](../apps/api/src/modules/auth/domain/login-lockout.ts): the pure rule "5 wrong passwords → locked 15 minutes". "Domain" files are plain functions with no database, which makes them easy to test ([login-lockout.spec.ts](../apps/api/src/modules/auth/domain/login-lockout.spec.ts)).
10. [src/modules/auth/repositories/student-auth.repository.ts](../apps/api/src/modules/auth/repositories/student-auth.repository.ts): the only kind of file allowed to talk to the database (through Prisma).
11. [prisma/schema.prisma](../apps/api/prisma/schema.prisma): the list of every database table and column.

**When something goes wrong** the service throws `new AppError(ErrorCode.INVALID_CREDENTIALS, '...')`. [src/common/filters/app-exception.filter.ts](../apps/api/src/common/filters/app-exception.filter.ts) turns that into the JSON answer `{ code, message, requestId }`, and the app shows the `message`.

The **admin website works the same way**: [features/auth/pages/LoginPage.tsx](../apps/admin/src/features/auth/pages/LoginPage.tsx) → [features/auth/api/auth-api.ts](../apps/admin/src/features/auth/api/auth-api.ts) → [shared/api-client/api-client.ts](../apps/admin/src/shared/api-client/api-client.ts) → `POST /api/v1/admin/auth/login` → [admin-auth.controller.ts](../apps/api/src/modules/admin/admin-auth/controllers/admin-auth.controller.ts) → [login-staff.service.ts](../apps/api/src/modules/admin/admin-auth/services/login-staff.service.ts).

### The pattern to remember

```
screen/page  →  hook  →  api file  →  api-client  →  HTTP  →  controller  →  service  →  domain rule
                                                                              ↓
                                                                         repository  →  database
```

Every feature follows this. To find the code behind any button: find the page, follow its api file to the URL, then search the API for that path.

---

## 5. Where things live

| I want to change…            | Look in                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| A student screen             | `apps/mobile/src/features/<feature>/screens/`                                      |
| An admin page                | `apps/admin/src/features/<feature>/pages/`                                         |
| Admin sidebar items          | `apps/admin/src/shared/layout/nav-items.ts`                                        |
| A form rule or error message | `packages/shared/src/schemas/` (used by app **and** API, so they always agree)     |
| Who may do what              | `packages/shared/src/permissions/` and [rbac-matrix.md](rbac-matrix.md)            |
| A business rule              | `apps/api/src/modules/<module>/domain/` and [business-rules.md](business-rules.md) |
| A database table             | `apps/api/prisma/schema.prisma`, then `pnpm db:migrate`                            |
| Colours and spacing          | `packages/shared/src/constants/theme.ts` (shared by both apps)                     |
| Settings and secrets         | `.env` (never commit it; `.env.example` shows what is needed)                      |
| Why a decision was made      | `docs/decisions/` (ADRs)                                                           |

Rules the code follows (from `CLAUDE.md`): no business rules in screens or controllers; database access only in `repositories/`; every admin change writes an audit-log entry; time is always India time (IST) with AM/PM.

---

## 6. Something is broken: a checklist

Work from top to bottom. Each step tells you which "arrow" from section 1 is broken.

### Step 1: Is the API alive?

Open http://localhost:3000/api/v1/health.

| You see                           | Meaning                     | Fix                                                           |
| --------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `{"status":"ok","database":"up"}` | API and database are fine   | go to step 2                                                  |
| `"database":"down"`               | API runs, database does not | start Docker Desktop, then `pnpm db:up`                       |
| "This site can't be reached"      | API is not running          | look at the `pnpm dev:api` terminal for a red error; start it |

### Step 2: Look at the API terminal

Every request now prints **one line** in the `pnpm dev:api` terminal, for example:

```
POST /api/v1/auth/login → 401 INVALID_CREDENTIALS (92 ms) [req fff2ca78-...]
GET /api/v1/admin/students → 403 PERMISSION_DENIED (4 ms) [req 7f19...]
```

- **No line appears when you press the button** → the request never reached the API. It's a network/address problem: go to step 3.
- **A line with 4xx (400–499)** → the API got the request and refused it. The code says why (table below).
- **A line with 500** → a bug in the API. The full error is printed right above it. Copy both.

| Code                       | What it means                                       | Typical fix                                                         |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `VALIDATION_FAILED`        | The data sent was wrong (missing field, format)     | read `message` / `details`; check the form                          |
| `UNAUTHENTICATED`          | Not signed in, or the session expired               | sign in again                                                       |
| `INVALID_CREDENTIALS`      | Wrong reference number / email or password          | check them; staff: the password from `.env` is only for first login |
| `ACCOUNT_LOCKED`           | Too many wrong passwords                            | wait 15 minutes, or unlock in the admin dashboard                   |
| `PASSWORD_CHANGE_REQUIRED` | Staff must change their password first              | the admin site sends you to Change password                         |
| `PERMISSION_DENIED`        | Your role is not allowed to do this                 | see `docs/rbac-matrix.md`; sign in as a Super Admin                 |
| `ROSTER_NOT_FOUND`         | Reference number is not in the roster               | import it (Students → Import roster) or run `pnpm db:seed:dev`      |
| `VERSION_CONFLICT`         | Someone else changed the record since you opened it | reload the page and try again                                       |
| `RATE_LIMITED`             | Too many attempts in a minute                       | wait a minute                                                       |

### Step 3: The phone cannot reach the API

The app shows _"Cannot reach the ENNEL server at http://…:3000"_.

1. In the `pnpm dev:mobile` terminal, read the `[ENNEL] API_URL = …` line.
2. On the **phone's browser**, open that address followed by `/api/v1/health`.
   - It works → restart the app (shake the phone → Reload).
   - It does not load → the phone cannot see your computer:
     - Is the phone on the **same Wi-Fi** (not mobile data)?
     - Some networks (college Wi-Fi, guest networks) block devices from seeing each other. Try your phone's hotspot with the computer connected to it.
     - Windows Firewall must allow "Node.js JavaScript Runtime" (it asks the first time; it is allowed on this computer).
3. If the address is `localhost` while you are on a phone, set `EXPO_PUBLIC_API_URL=http://<computer address>:3000` in `apps/mobile/.env` (find the address with `ipconfig`, "IPv4 Address" under Wi-Fi), then restart `pnpm dev:mobile`.

### Step 4: The admin website shows an error

1. Press **F12** in the browser → **Network** tab → repeat the action.
2. Click the red request. **Response** shows the error JSON with `code`, `message` and `requestId`.
3. The **Console** tab shows JavaScript errors (red text) if the page itself crashed.
4. Find the same `requestId` in the API terminal to see the server side.

### Step 5: Look at the data itself

`pnpm db:studio` opens **Prisma Studio** at http://localhost:5555. It's a spreadsheet-like view of every table. Use it to check, for example, whether a student exists in `college_roster`, or what `audit_logs` recorded. Be careful: edits there skip all the app's checks and the audit log.

### Step 6: Common one-off problems

| Symptom                                                                                        | Fix                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| API crashes on start with `Cannot find module '@ennel/shared'` or "does not provide an export" | `pnpm build:shared` (or keep `pnpm dev:shared` running), then restart the API                 |
| `Port 3000 is already in use`                                                                  | an old API is still running in another window; close it                                       |
| `Can't reach database server`                                                                  | Docker Desktop is closed; open it, then `pnpm db:up`                                          |
| Error about a missing column or table                                                          | `pnpm db:migrate`                                                                             |
| Admin forgot password and is locked out                                                        | `pnpm db:seed` does **not** reset it. Ask another Super Admin to reset it from Staff & roles. |
| Everything is weird after pulling new code                                                     | `pnpm install`, `pnpm build:shared`, `pnpm db:migrate`, then restart all terminals            |
| Phone: _"Project is incompatible with this version of Expo Go"_                                | Update Expo Go from the Play Store / App Store (the project needs SDK 58)                     |
| Student app still shows an old error or old styling after a fix                                | stop Expo (Ctrl+C) and start it with a cleared cache: `pnpm dev:mobile --clear`               |
| Web: _"Cannot manually set color scheme, as dark mode is type 'media'"_                        | fixed in `apps/mobile/tailwind.config.js` (`darkMode: 'class'`); restart Expo with `--clear`  |
| Expo says _"An update for expo is available"_ or _"packages may need updating"_                | `cd apps/mobile`, then `npx expo install --check`; ask before upgrading to a new SDK number   |
| Browser console: _"blocked by CORS policy"_                                                    | the API only accepts the admin site, plus `localhost` pages in development; see section 3     |

---

## 7. Asking Claude (or anyone) for help

You'll get a fix much faster if you paste:

1. **What you did** ("pressed Log In on the phone with 24900001").
2. **What you saw** (exact message or a screenshot).
3. **The API terminal line** for that moment (with the `[req …]` ID), and any red text above it.
4. For the admin site: the **Response** of the failed request from F12 → Network.
5. For the phone: the `[ENNEL] API_URL` line and anything red in the Expo terminal.

"It doesn't work" can mean twenty different things. These five details narrow it down to one.

---

## 8. Checking your own changes

| Command          | What it checks                                                                   |
| ---------------- | -------------------------------------------------------------------------------- |
| `pnpm typecheck` | TypeScript finds mistakes like a wrong field name or a missing argument          |
| `pnpm lint`      | Style and project rules (for example: no database code outside repositories)     |
| `pnpm test`      | Automated tests (Docker must be running; API tests use a separate test database) |

Run all three before committing.

If an API integration test fails with only a status code (for example 500), run it again with server errors shown: set `TEST_LOGS=1` before the test command (in Git Bash: `TEST_LOGS=1 pnpm --filter @ennel/api test`). If one fails, the first error message usually names the file and line.

---

## 9. Words you will see

| Word             | Meaning                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| API              | The server program (`apps/api`) that the apps send requests to                               |
| Endpoint / route | One URL + method the API answers, e.g. `POST /api/v1/auth/login`                             |
| Controller       | API file that receives a request and hands it to a service                                   |
| Service          | API file that performs one action (a "use case")                                             |
| Domain           | Pure rule functions, no database; easy to test                                               |
| Repository       | The only files that read and write the database                                              |
| Prisma           | The library the API uses to talk to PostgreSQL; `schema.prisma` lists the tables             |
| Migration        | A saved change to the database structure (`pnpm db:migrate` applies them)                    |
| Seed             | A script that fills the database with starting data (`pnpm db:seed`)                         |
| Zod schema       | A description of valid data (e.g. "password at least 8 characters"), shared by app and API   |
| Access token     | Short-lived proof that you are signed in, sent with each request                             |
| Refresh token    | Longer-lived token used to get a new access token without signing in again                   |
| Request ID       | A unique ID for one request; it ties an error in the app to the matching line in the API log |
| Expo / Expo Go   | Tools to run the React Native student app on your phone during development                   |
| Vite             | The tool that serves the admin website during development                                    |
