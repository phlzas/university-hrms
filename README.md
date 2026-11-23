# University HRMS (Full-stack MVP)

Next.js 16 + React 19 + Prisma + SQLite HRMS. Arabic/RTL UI.

## Quick start (Windows)

Open PowerShell in this folder and run:

```powershell
npm run dev
```

Then open **http://localhost:3000**. Do not use `127.0.0.1`.

If `node_modules` is missing:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npx prisma generate
npx prisma migrate deploy
npm run dev
```

`.env` should contain:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-strong-secret"
```

The bundled `prisma/dev.db` is already seeded. Do **not** delete it and do **not** run `npx prisma migrate reset`; that removes the test users and demo data. If you change `prisma/schema.prisma` and get 500 errors, run `npx prisma generate`, then stop the dev server with Ctrl+C and restart it.

## Test accounts and what you should see

| Role | Email | Password | What you should see |
|---|---|---|---|
| HR | `hr@hrms.local` | `Hr@12345` | full CRUD: create, edit, rename, delete, import, permissions |
| ADMIN | `admin@hrms.local` | `Admin@12345` | create + read only: no edit/delete/import/share |
| VIEWER | `viewer@hrms.local` | `Viewer@12345` | read-only |
| HR_SUPER_ADMIN | `superadmin@hrms.local` | `SuperAdmin@12345` | full CRUD |

## Permission differences

The table above describes the legacy Documents/Files permissions from the original HRMS app: `create`, `read`, `update`, `delete`, `import`, `managePermissions`, and `readAllFiles`. HR and HR_SUPER_ADMIN get full document CRUD. ADMIN can create/upload and read files, but cannot edit, delete, import, or share. VIEWER can only read.

Employee lifecycle permissions are separate and stricter:

- HR_SUPER_ADMIN: full employee lifecycle — create, edit, delete, restore, provision accounts, and seed.
- HR: can create employees, but cannot edit/delete/restore/provision.
- ADMIN: can provision fixed-role `EMPLOYEE` accounts and read only four employee fields (`employeeId`, `name`, `email`, `status`); no employee create/edit/delete/import/share.
- VIEWER: read-only.
- `EMPLOYEE` accounts are created through ADMIN provisioning and invite links; there is no hardcoded employee password.

The source of truth is `src/lib/permissions.ts`: the seven legacy capabilities govern Documents/Files, while employee lifecycle capabilities govern employees.

## Seed

The bundled database is already seeded. If needed, log in as `HR_SUPER_ADMIN`; the Seed button appears only for that role. Seeding is idempotent: it does not delete data or reset passwords.

## Verify

```powershell
npm test -- --runInBand
npm run build
```

## Notes

- SQLite is for local MVP use; use Postgres for production.
- File uploads are stored in `public/uploads` for MVP; move to secure storage for production.
- Attendance rules are display/MVP defaults (grace 20 min, no auto deduction).
