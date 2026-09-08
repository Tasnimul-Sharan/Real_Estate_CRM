# Real Estate CRM - NestJS + Next.js + PostgreSQL

A professional starter CRM for real-estate sales operations. It includes authentication, role-based access, leads, customers, projects, plot inventory, follow-ups, bookings, payments and dashboard KPIs.

## Fastest start (Docker Desktop)

```bash
docker compose up --build
```

Then open:
- CRM UI: http://localhost:3000
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/docs

Default seeded login:
- Email: `admin@crm.local`
- Password: `Admin@12345`

> Change the default password and JWT secret before real deployment.

## Local development

Start PostgreSQL, copy each `.env.example` to `.env`, then:

```bash
cd apps/api
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run start:dev
```

In another terminal:

```bash
cd apps/web
npm install
npm run dev
```

See `Real_Estate_CRM_Complete_Guide.docx` for the detailed Bengali/English guide.
# Real_Estate_CRM

## Dependency maintenance and warning checks

Run npm commands from `apps/api` or `apps/web`; the repository root has no package.json.
Both apps now include lockfiles. Use `npm ci` to reproduce the checked versions.
For editor types, run `npx prisma generate` in `apps/api` and `npm run build` in `apps/web` once after installation.

From either app folder:

```bash
npm audit
npm run typecheck
```

From the project root, with Docker Desktop running:

```bash
docker compose up -d --build
docker compose logs --tail 100 api web
```

The Compose project name stays `real_estate_crm_nestjs_complete` so renaming this folder reuses the existing database volume.
Prisma CLI and seed configuration is in `apps/api/prisma.config.ts`, which explicitly loads `.env`.

Two scoped dependency overrides supply patched transitive packages: `@prisma/config` uses `deepmerge-ts` 8.0.2, and Next.js uses PostCSS 8.5.28. Recheck these overrides when upgrading their parent packages; Prisma generation/validation/startup and Next.js production builds were verified with them.

The `.gitattributes` file standardizes source files on LF line endings. npm funding/update notices and Prisma tips are informational, not application warnings or build failures.
