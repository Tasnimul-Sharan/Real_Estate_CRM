# Real Estate CRM

NestJS, Next.js and PostgreSQL CRM with leads, follow-ups, customers, property inventory, bookings, payments and a responsive dashboard.

## Start an already configured installation

Start Docker Desktop, then run from this directory:

```powershell
docker compose up -d
docker compose ps
```

Open http://localhost:3000. Administrator credentials are saved locally in `.secrets/administrator-login.txt`. There is no default password. Keep `.env`, `.secrets` and database backups private; they are excluded from Git. Ports are bound to localhost. Domain, HTTPS and internet-facing deployment are separate work.

## First installation with an empty database

```powershell
./scripts/Initialize-Security.ps1 -AdminEmail 'admin@your-company.example'
docker compose up -d db
docker compose build api web
docker compose run --rm --no-deps api npx prisma migrate deploy
./scripts/Initialize-Admin.ps1
docker compose up -d
```

`Initialize-Admin.ps1` passes credentials through environment variables without printing them. Use its `-RotateExisting` switch only when intentionally replacing the existing administrator password. Do not put passwords in command history.

`Initialize-Security.ps1` refuses to replace an existing `.env`. It generates unique database/JWT/admin secrets and restricts the secret files to the current Windows user and SYSTEM. Initializing an existing installation also requires rotating the PostgreSQL role password; changing POSTGRES_PASSWORD alone does not change an existing database role.

## Database migrations

Normal API startup runs `prisma migrate deploy`; it does not run `db push` or seed business records. Migrations live in `apps/api/prisma/migrations`.

For a legacy database originally created by `db push`, take and restore-test a backup first, stop API writes, run `scripts/preflight.sql`, and use `./scripts/Baseline-Existing.ps1` once. This checks that the existing schema matches the baseline, records the baseline as applied, then applies booking constraints. Never baseline an unrelated or mismatched database. Do not edit an applied migration; add a new migration instead.

The booking integrity migration provides a database unique index for one non-cancelled booking per plot and positive-value checks. Application transactions lock the plot before inventory, booking and payment changes.

## Backups and restore

The `backup` service makes a custom-format PostgreSQL backup on startup and every 24 hours while Docker is running. It keeps at least 14 days of backups under `backups/`, with SHA-256 checksums. A failed backup exits visibly and Docker restarts the service. This is a local backup; separately arrange an encrypted off-device copy for disaster recovery.

```powershell
./scripts/Backup-Database.ps1
./scripts/Test-Restore.ps1 -BackupPath './backups/crm-YYYYMMDDTHHMMSSZ.dump'
docker compose logs --tail 20 backup
```

Restore tests create a temporary PostgreSQL container without network access, verify the checksum, restore with errors treated as failures, and write table row counts/content fingerprints beside the backup. The temporary container is removed afterward. They never overwrite live data.

For recovery to a new database in the existing database container:

```powershell
./scripts/Restore-Database.ps1 -BackupPath './backups/crm-YYYYMMDDTHHMMSSZ.dump' -TargetDatabase crm_restore_recovery
```

Verify recovered data before planning a cutover. The script refuses to overwrite the live database.

## Workflow and permissions

Open a lead and choose **Convert to customer**. Conversion reuses a customer with the same phone, links the lead and is repeatable without duplicating that customer. Create a booking from available inventory, record payments, then manage booking status from the Bookings page.

| Operation | Allowed roles |
| --- | --- |
| Read CRM records | All six active roles |
| Leads, customers, activities and bookings | Super admin, admin, sales manager, sales executive |
| Projects, blocks and plots | Super admin, admin, sales manager |
| Record payments | Super admin, admin, sales manager, accounts |
| Manage users | Super admin and admin |
| Manage super admins | Super admin only |

Permissions are enforced by the API. An inactive account loses access immediately, and existing sessions use the current database role. At least one active super admin must remain. The current policy permits organization-wide reads; per-salesperson data isolation is not implemented.

Cancelled bookings release inventory. Reopening requires the plot to remain available. Repeating cancellation on an old booking never releases a newer booking's plot. Completed sales are terminal. Payments require a confirmed/completed booking; bookings with payments cannot be cancelled because refund accounting is outside this release. Payment recording remains manual and does not include installments, receipts or a payment gateway.

## Automated checks

```powershell
./scripts/Test-Workflow.ps1
```

This builds a separate Compose project, applies migrations to a temporary database and runs the Node test runner. It covers the complete lead-to-payment workflow, all roles, forbidden writes, conversion, eight simultaneous bookings, cancellation/reopening, payment/cancellation races, invalid values, database constraints and account changes. It cannot run against the live database. Test data is discarded with the test containers.

## Development and maintenance

Run npm commands inside `apps/api` or `apps/web`; there is no root package.json. Use `npm ci`, then `npm run typecheck`. For local API development, populate `apps/api/.env` from the private generated configuration, run `npx prisma generate`, `npm run prisma:migrate`, then `npm run start:dev`. Start the frontend with `npm run dev` inside `apps/web`.

Use `docker compose up -d --build` after source changes. Run `npm audit` in both apps when maintaining dependencies. Scoped dependency overrides patch Prisma's deepmerge-ts and Next's PostCSS; reassess them when upgrading parent packages. Swagger is disabled by default; set `ENABLE_API_DOCS=true` in local configuration to enable `/docs`.

Demo seeding is explicit, requires `SEED_DEMO=true` plus supplied administrator credentials, and is forbidden in production. The older Word guide describes the starter version; this README supersedes its startup, password, database and backup instructions.

## Configurable role access

Sign in as **SUPER_ADMIN**, open **Roles & Access**, select a role, choose its View/Create/Edit and special-action permissions, then click **Save access**. The page automatically includes required read permissions; turning a prerequisite off removes dependent actions. Existing roles retain their previous defaults until saved. An empty policy denies all feature access.

Use **Team & users → Edit user → Role** to assign a role or deactivate an account. API requests check the current account and role permissions on every request, including existing sessions. Open pages refresh permissions every 15 seconds and on navigation/focus; permission changes refresh page data and controls. Denied modules are hidden from navigation, blocked on direct URLs and API routes, and removed from related records and dashboard summaries.

Only Super Admin can configure permissions. Super Admin access is protected, and at least one active Super Admin must remain. Other user managers can only assign/manage roles whose permissions are within their own. Permission edits are versioned to prevent accidental overwrite and recorded with the actor, before/after permissions and timestamp.

Run `scripts/Test-Workflow.ps1` for isolated API workflow and permission tests. For a disposable UI preview, use `docker compose -f docker-compose.test.yml --profile ui up -d --build db api web` (port 3100; test-only admin credentials are in that compose file). Stop with `docker compose -f docker-compose.test.yml --profile ui down`; the test database is temporary and separate from live data.
