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
