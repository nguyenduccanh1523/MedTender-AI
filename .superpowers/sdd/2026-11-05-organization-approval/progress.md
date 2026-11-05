# SDD ledger — plan: docs/superpowers/plans/2026-11-05-organization-approval.md

Ruling: repository has no `.git`, so worktree, task commits and Git review ranges are unavailable — execute in the shared workspace and keep test evidence in this ledger — cost if wrong: changes lack commit-level rollback until the user initializes Git.
Pre-flight: Task 1 produces global identity and models consumed by Tasks 2–4; Task 2 produces contracts consumed by Task 3; interfaces match the design spec.

## Delivery record — 2026-11-05

- Task 1 complete: introduced `SYSTEM_ADMIN`, organization applications, one-time account-activation tokens, Prisma models, eight additive PostgreSQL migrations, least-privilege grants, and RLS policies. The final migration removes the recursive membership policy discovered during the integration test.
- Task 2 complete: public application API, System Admin list/approve/reject API, JWT-cookie account activation, System Admin bootstrap command, and generated OpenAPI contracts are implemented.
- Task 3 complete: public `/apply`, activation `/activate`, System Admin `/system-admin/organization-requests`, approval-oriented organization picker, and landing page were implemented. `EMAIL_DELIVERY_MODE=LOG` exposes a local-only activation link to the System Admin; `RESEND` sends a real email when configured.
- Task 4 complete: documentation added at `docs/hoc-phong-van/02c-system-admin-va-phe-duyet-to-chuc.md`, and Supabase migrations were applied successfully (8 migrations visible in `_prisma_migrations`).

Verification evidence:

- `pnpm -C be test`: API 4, worker 5, FE 5, AI 2 tests passed.
- `pnpm -C be test:db`: 3 suites / 9 tenant, approval, and activation integration tests passed.
- `pnpm -C be test:redis`, `pnpm -C be lint`, `pnpm -C be typecheck`, and `pnpm -C be build` passed.
- Headless Chrome smoke test passed: public application → System Admin approval → owner activation → owner workspace.

Operational rulings:

- Supabase is PostgreSQL. The migration/admin connection may use `postgres`, but the runtime app must use a separate login password for `medtender_app` and `&uselibpqcompat=true` for the current Node PostgreSQL TLS behavior.
- Actual production-like runtime connection and the permanent System Admin bootstrap require user-provided credentials in `.env`; these are intentionally not generated, stored, or committed by the project.
- The previously used database password must be rotated in Supabase because it was exposed in a diagnostic command output; update `.env` after rotation.
