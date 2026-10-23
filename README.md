# M3M One

In-house project governance platform for Smart World / M3M: projects, key ratios with benchmark checks, design question bank (chapters), roles and module access, notifications and audit logs.

```
database/schema.sql   SQL Server schema (25 tables)
server/               Node.js + Express + Sequelize API  (/v1/...)
shared/keyRatio.js    Key-ratio formulas, benchmark checks and cost-of-deviation (used by server and client)
```

## 1. Database (SQL Server 2019+)

1. Create the database `M3M_One` and run `database/schema.sql` on it.
2. Create an application login with `db_datareader` + `db_datawriter` on `M3M_One`.

## 2. API server

Requires Node.js 20+.

```bash
cd server
npm install
cp .env.example .env        # fill in DB_*, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

Put the reference data files in `server/seed/data/` (they are company data and are not committed):
`benchmarks.json`, `chapters-residential.json`, `keyratio-residential.json`.

```bash
npm run seed                # creates the first super admin + modules, question bank, benchmarks (safe to re-run)
npm start                   # http://localhost:4000/v1   health check: /health
```

For local development without SQL Server, set `DB_DIALECT=sqlite` — tables are created automatically in `server/data.sqlite`.

Run it as a service in production (pm2 or NSSM on Windows):

```bash
npm i -g pm2 && pm2 start src/server.js --name m3m-one-api && pm2 save
```

## API overview

All responses: `{ success, message, data }`. Auth: `Authorization: Bearer <accessToken>` from `POST /v1/auth/login`.

| Area | Endpoints |
|---|---|
| Auth & users | `POST /auth/login`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET/POST /auth/users`, `PUT/DELETE /auth/users/:id`, `GET /auth/users?assigneesFor=` |
| Projects | `GET /project` (search, projectType, projectCategory, fromDate, toDate, page, limit, locationCategory), `GET/PUT/DELETE /project/:id`, `POST /project`, `GET /project/contributor/tasks`, `PUT /project/:id/save-project-module` |
| Modules & chapters | `GET /project/:id/module`, `GET /module/:id`, `GET /project/:id/module/:mid/chapter[?chapterId=]`, `PUT /project/:id/module/:mid/chapter/:cid`, `PUT .../chapter/saveAndDraft/:cid`, `POST /project/:id/module/:mid/import`, `POST /module/sample/:mid` |
| Key ratio | `GET/POST/PUT /keyRatio`, `POST /keyRatio/saveAsDraft`, `GET/POST/PUT /commercial/create-key-ratio`, `PUT/POST /commercial/save-as-draft`, `POST /compare/get-projects` |
| Platform | `GET/POST /roles`, `PUT/DELETE /roles/:id`, `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/mark-all-read`, `GET /audit-logs`, `GET /audit-logs/export`, `POST /upload`, `GET/POST/DELETE /metadata/dropdown-options`, `GET /benchmark` |

## Not yet built

- Design-brief department routes (liaison, business development, land, structure, MEP), design-brief summary/comments and DPR PDF export — the tables exist in `schema.sql`.
- Commercial key-ratio input/benchmark definitions and the commercial question bank (to be imported from the previous system's data export).
- Password-reset emails (links are currently written to the server log).

## 3. Web app

The built web app is committed in `client/dist/` and is served by the API on the same port —
after `pm2 restart m3m-one-api`, open **http://localhost:4000** (or `http://<server-name>:4000` from other PCs once port 4000 is open in Windows Firewall).

To change the frontend: `cd client && npm install && npm run dev` (opens on http://localhost:5173, proxies to the API on 4000), then `npm run build` and commit `client/dist`.

Screens: sign in / password reset, projects (search, filters, portfolio switcher), project create/edit, project overview with module scores, key ratios (live benchmark checks, ₹ Cr impact, flags and remarks, CSV import, drafts), chapter questions (benchmark matching per category, flags, remarks, CSV import, drafts), users, module access per company/department, activity log with CSV export, notifications.
