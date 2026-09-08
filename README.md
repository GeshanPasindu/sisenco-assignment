# Weekly Reporting Task Manager

A weekly reporting application with a React frontend, NestJS API, and PostgreSQL database.

This repository contains two separate Node.js projects:

| Folder | Purpose |
| --- | --- |
| `web-app` | React + Vite frontend |
| `web-api` | NestJS API, Prisma migrations, seeds, and PostgreSQL access |

## What you need first

Install these before starting:

- [Node.js](https://nodejs.org/) 22 or newer (includes npm)
- PostgreSQL 15 or newer for local development
- Git

On Windows PowerShell, use `npm.cmd` instead of `npm` if PowerShell blocks `npm.ps1`.

## 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd sisenco-assignment
```

All commands below are run from the indicated folder.

## 2. Create a local PostgreSQL database

Create an empty database named `task_manager`. You can use pgAdmin, or run this in a terminal where PostgreSQL tools are available:

```bash
createdb -U postgres task_manager
```

If your PostgreSQL username is not `postgres`, replace it in the commands and connection string below.

## 3. Configure and start the backend

Open a terminal in `web-api`:

```bash
cd web-api
npm install
```

Copy the environment file:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS/Linux
cp .env.example .env
```

Open `web-api/.env` and set `DATABASE_URL` to your local database. Replace the username and password:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/task_manager?schema=task_manager"
```

If the password contains characters such as `@`, `:`, `/`, `?`, or spaces, URL-encode it. For example, a space becomes `%20` and `@` becomes `%40`.

Set the remaining required local values. Copy this block into `web-api/.env` and keep your own `DATABASE_URL` above it:

```dotenv
NODE_ENV=development
PORT=3001
CORS_ORIGINS=http://localhost:5173
JWT_ISSUER=weekly-report-api
JWT_AUDIENCE=weekly-report-frontend
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
PASSWORD_MIN_LENGTH=8
PASSWORD_MAX_LENGTH=128
```

### Create a strong JWT secret

`JWT_SECRET` signs login tokens. It must be different for every environment and must never be committed to Git.

For local development, leave `JWT_SECRET=` blank and run this command once:

```bash
npm run auth:setup
```

It writes a secure random secret into your ignored `web-api/.env` file.

### Run the database setup in this exact order

These commands have different jobs. Run them one at a time from `web-api`:

```bash
# 1. Create Prisma's generated client files.
npm run db:generate

# 2. Create/update database tables and apply every checked-in migration.
npm run db:migrate

# 3. Add the two roles, all permissions, and their role-permission links.
npm run db:seed
```

At this point the database has tables, roles, and permissions, but no users yet. Continue to the next section to add a first local user.

Do not start the API yet if you want demo data; run the optional demo seed next. You will start the API after that step.

## 4. Add a first local admin and sample data

The simplest local option is the demo seed. It creates the first manager/admin, three team members, projects, tasks, time entries, and reports.

In the `web-api` terminal, choose a temporary password of at least eight characters and run:

```powershell
$env:DEMO_SEED_PASSWORD='Choose-a-local-demo-password'
npm run db:seed:demo
Remove-Item Env:DEMO_SEED_PASSWORD
```

On macOS/Linux:

```bash
DEMO_SEED_PASSWORD='Choose-a-local-demo-password' npm run db:seed:demo
```

The demo seed is idempotent: running it again updates the same demo records instead of duplicating them. It refuses non-local databases by default.

Sign in with one of these accounts and the password you chose:

| Account | Role |
| --- | --- |
| `admin@demo.local` | Manager/Admin |
| `alice@demo.local` | Team member |
| `ben@demo.local` | Team member |
| `carla@demo.local` | Team member |

Now start the API in the `web-api` terminal:

```bash
npm run start:dev
```

The API is now available at `http://localhost:3001/api/v1`. API documentation is available at `http://localhost:3001/api`.

## 5. Configure and start the frontend

Open a second terminal in `web-app`:

```bash
cd web-app
npm install
```

Create the frontend environment file before starting Vite:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS/Linux
cp .env.example .env
```

Open `web-app/.env` and set the API URL exactly as follows:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

The `/api/v1` part is required. If the backend runs on another port, update this value to match it.

Start the frontend:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Environment variables

### Backend: `web-api/.env`

| Variable | Required locally | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Never commit it. |
| `NODE_ENV` | Yes | Use `development` for local running. |
| `PORT` | Yes | API port; local default is `3001`. |
| `CORS_ORIGINS` | Yes | Exact frontend origin, such as `http://localhost:5173`. No trailing path. |
| `JWT_SECRET` | Yes | Strong random base64 signing secret. `npm run auth:setup` creates it locally. |
| `JWT_ISSUER` | Yes | Token issuer; keep `weekly-report-api` unless all clients change together. |
| `JWT_AUDIENCE` | Yes | Token audience; keep `weekly-report-frontend` unless all clients change together. |
| `COOKIE_SECURE` | Yes | Use `false` for local HTTP development. |
| `COOKIE_SAME_SITE` | Yes | `lax` locally; use `none` with `COOKIE_SECURE=true` for separate frontend/API domains. |
| `PASSWORD_MIN_LENGTH` | Yes | Minimum password length; default is `8`. |
| `PASSWORD_MAX_LENGTH` | Yes | Maximum password length; default is `128`. |

### Optional email (SMTP) settings

SMTP is only needed if invitation emails should be sent automatically. Without it, the app still works: an admin can copy the generated invitation link and share it securely.

For Gmail, create a Gmail App Password, then add these values to `web-api/.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASSWORD=your-16-character-gmail-app-password
SMTP_FROM="Task Manager <your-gmail-address@gmail.com>"
INVITATION_URL_BASE=http://localhost:5173
```

Never commit SMTP passwords. For local development, keep `INVITATION_URL_BASE=http://localhost:5173`.

### Frontend: `web-app/.env`

| Variable | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | Public API base URL, including `/api/v1`. |

Vite variables are built into the frontend bundle. Restart the frontend after changing `VITE_API_BASE_URL`.

## Database migrations and seeds, explained

Run these from `web-api`.

| Command | When to use it |
| --- | --- |
| `npm run db:generate` | Generates the Prisma client after a fresh install or schema change. It does not change the database. |
| `npm run db:migrate` | Creates/updates tables by applying migration files. Run this first on every new database. |
| `npm run db:seed` | Adds roles, permissions, and role-permission grants. It does not add users. |
| `npm run db:seed:demo` | Adds the local demo users and work data. Requires `DEMO_SEED_PASSWORD`. |
| `npm run db:status` | Check whether migrations are applied. |

For a brand-new database, always use this sequence:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
# Optional for local development only:
npm run db:seed:demo
```

For an existing database after pulling new code, use:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

For local development, run `npm run db:migrate` whenever you pull migration changes from the repository.

## Creating the first admin manually

Use this when you want a clean local database without the demo users. First complete the migration and RBAC seed steps above. `db:seed` must succeed because it creates the `MANAGER_ADMIN` role used below.

1. Generate an Argon2 hash for the password the first admin will use. Choose a private password of at least eight characters. Copy the entire output value, which begins with `$argon2id$`:

   ```bash
   node -e "const a=require('argon2'); a.hash(process.argv[1], {type:a.argon2id,memoryCost:65536,timeCost:3,parallelism:1}).then(console.log)" "YOUR_PRIVATE_PASSWORD"
   ```

2. Open a SQL client for your local PostgreSQL database (for example, pgAdmin Query Tool). Before running the query, replace `admin@your-company.com` in both places, replace `EMP-ADMIN-001`, `Admin`, and `Manager` with the real employee details, and replace `<PASTE_ARGON2_HASH>` with the complete value copied in step 1.

   ```sql
   WITH bootstrap AS (SELECT CURRENT_TIMESTAMP AS created_at)
   INSERT INTO task_manager.users (
     id, role_id, employee_id, first_name, last_name, email,
     password_hash, created_at, updated_at, activated_at
   )
   SELECT
     md5('bootstrap:admin@your-company.com')::uuid,
     r.id,
     'EMP-ADMIN-001',
     'Admin',
     'Manager',
     'admin@your-company.com',
     '<PASTE_ARGON2_HASH>',
     b.created_at,
     b.created_at,
     b.created_at
   FROM task_manager.roles r
   CROSS JOIN bootstrap b
   WHERE r.code = 'MANAGER_ADMIN'
     AND r.deleted_at IS NULL
   ON CONFLICT (email) DO UPDATE
   SET
     role_id = EXCLUDED.role_id,
     password_hash = EXCLUDED.password_hash,
     activated_at = CURRENT_TIMESTAMP,
     deactivated_at = NULL,
     deleted_at = NULL,
     updated_at = CURRENT_TIMESTAMP;
   ```

3. Run the query. Then run this check, replacing the email, to confirm the account is active and has the manager role:

   ```sql
   SELECT u.email, u.employee_id, u.activated_at, r.code AS role
   FROM task_manager.users u
   JOIN task_manager.roles r ON r.id = u.role_id
   WHERE u.email = 'admin@your-company.com';
   ```

4. Open the frontend and sign in with that email and the original password from step 1.

The local connection in this guide uses the `task_manager` schema. If you changed `?schema=task_manager` in `DATABASE_URL`, replace `task_manager` in the SQL with your chosen schema name.

## Checks

```bash
# Backend, from web-api
npm run type-check
npm test

# Frontend, from web-app
npm run test
npm run build
```

## Common problems

| Problem | What to check |
| --- | --- |
| Frontend cannot log in or shows a network error | Confirm the API is running on port `3001` and `VITE_API_BASE_URL` ends with `/api/v1`. |
| Browser reports a CORS/origin error | Set `CORS_ORIGINS` to the exact frontend URL, with no trailing slash or path. Restart the API. |
| `Role` or `Permission` table is missing | Run `npm run db:migrate`, then `npm run db:seed`. |
| No one can log in | Run the local demo seed, or bootstrap the first manager/admin as described above. |
| PowerShell blocks npm | Run the same command with `npm.cmd`, for example `npm.cmd run start:dev`. |
