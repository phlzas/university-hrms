# University HRMS (Full-stack MVP)

Next.js (App Router) + Node.js + Prisma + SQLite HRMS. Arabic/RTL UI.

## Features
- Auth (cookie session, JWT) with seed admin
- Dashboard stats
- Employees CRUD (basic create/list)
- Attendance: list/filter + Excel/CSV import (`ID, Names, Quentin, Out` supported)
- Leaves: create/list
- Documents: upload/list (stored in `public/uploads` for MVP)

## Setup
```bash
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000

## Seed admin
- Go to login page and click **"تجهيز بيانات أولية (Seed)"**, or POST `/api/seed`
- Default: `admin@hrms.local` / `Admin@12345`

## Env
Copy `.env.example` to `.env` and set `JWT_SECRET`.

## Notes
- SQLite for local MVP; switch Prisma datasource for production (Postgres recommended).
- File uploads use local `public/uploads` in MVP; move to S3/secure storage for production.
- Attendance rules are display/MVP defaults (grace 20 min, no auto deduction).
