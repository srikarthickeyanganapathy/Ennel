# ADR-0001: Modular monolith in a pnpm monorepo

- Status: Accepted
- Date: 2026-10-19

## Context

ENNEL has a student mobile app, an admin web app and one backend that share types, validation and permission keys. The team is small, and the deployment target is undecided (deployment is out of scope).

## Decision

- One NestJS app with feature modules and layered internals (controller → application service → domain → repository). Two route surfaces: `/api/v1` and `/api/v1/admin`.
- A BullMQ worker runs from the same codebase as a separate local process.
- pnpm workspaces: `apps/api`, `apps/mobile`, `apps/admin`, `packages/shared` (`@ennel/shared`).

## Consequences

- One place for each business rule, shared by student and admin paths.
- Module boundaries are enforced by convention and lint rules (no cross-module repository imports), not by network boundaries.
- Splitting a module out later is possible because it only talks to others through exported services or domain functions.
