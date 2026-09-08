# Authentication stage

Implements the shared API conventions and **A01–A06** from the supplied
`backend-endpoints.md` Revision 2, with the existing weekly-report database rules.
The database schema and applied migration are unchanged. No users, roles,
permissions or invitation emails are seeded or sent by this stage.

## Routes and contract

All routes are POST under `/api/v1/auth`:

| Route                | Credential                                            | Success                   |
| -------------------- | ----------------------------------------------------- | ------------------------- |
| `/login`             | email/password; public, throttled                     | 200 AuthTokensDto         |
| `/refresh`           | refreshToken cookie; no body                          | 200 AuthTokensDto         |
| `/logout`            | optional refreshToken cookie; no body                 | 204                       |
| `/change-password`   | bearer JWT and current password                       | 204                       |
| `/invitations/check` | invitation token in JSON; public, throttled           | 200 InvitationPrefillDto  |
| `/accept-invitation` | invitation token, password and allowed profile fields | 200 `{ activated: true }` |

Every auth POST requires an **exact allowed Origin** header, including login and
invitation requests. Browser fetch supplies it automatically. CLI clients must
send it explicitly. No endpoint requires a manager role or an invented
password-change permission. Authentication is applied explicitly to A04; public
endpoints still run global throttling and the origin/request-contract guard.
Refresh credential verification occurs inside AuthService's transaction, rather
than in a separate guard that would validate only before rotation.

JSON success is `{ data, meta: { requestId } }`. Errors use the documented
`{ error: { statusCode, code, message, details, context }, meta: { requestId } }`.
`X-Request-Id` matches the envelope; 204 responses have only headers and no body.
Safe incoming request IDs (letters, digits, underscore/hyphen, at most 100
characters) are retained; other values receive a generated UUID. Auth responses
have `Cache-Control: no-store`.

Unknown DTO fields and auth query parameters are rejected. Refresh and logout
reject any request body, including `{}`. JSON bodies have a 32 KiB transport cap.
Company email is trimmed/lowercased. Passwords are never normalized or trimmed.
The default new-password policy is 15–128 Unicode code points with spaces allowed
and no character-composition rules; it applies to acceptance/change only. Login
and current-password verification allow existing password lengths.

Safe response mapping returns only the documented session-user fields, including
all actual current grants. Prisma entities are never returned directly. Missing,
invited, deactivated or retired-role logins use the same `INVALID_CREDENTIALS`
response. Unusable invitation credentials use `INVALID_INVITATION`; refresh uses
`INVALID_REFRESH_SESSION`. Password mismatch at A04 is
`400 CURRENT_PASSWORD_INCORRECT`. Infrastructure failures are not swallowed by
logout: connection/time-out failures produce a generic 503 and clear the cookie.
Errors never serialize submitted secrets, SQL or internal exception messages.

Swagger remains at `/api`, with its JSON at `/api-json`. It includes request
allowlists, success/error envelopes, bearer security, refresh-cookie security,
origin requirements and cookie headers. Configured password bounds are reflected
in its schemas. The existing starter root is now `/api/v1` with the shared envelope.

## Local configuration

For the current local development database, run:

```sh
npm ci
npm run auth:setup
npm run db:generate
npm run start:dev
```

`auth:setup` requires an existing `.env` and a loopback development database URL.
It fills missing auth settings and writes a random 48-byte signing secret directly
to ignored `.env`, without displaying it. Existing values are retained; the
literal non-secret JWT placeholder from `.env.example` is replaced. Review any
existing values yourself if validation reports invalid configuration. Do not
copy `.env.example` over a configured `.env`.

The setup command was run for this workspace: development defaults and a signing
secret were added, with the existing database credential preserved. The frontend
default is `http://localhost:5173`, API default `http://localhost:3001`. Change the
origin setting if your frontend uses a different origin, then restart the API.
Use `npm.cmd` in PowerShell when execution policy blocks the npm `.ps1` wrapper.

| Variable                  | Meaning/default                                                |
| ------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`            | Existing PostgreSQL URL; preserve `?schema=task_manager`       |
| `NODE_ENV`                | `development` locally; set `production` for deployment         |
| `JWT_SECRET`              | Required base64 random secret decoding to at least 32 bytes    |
| `JWT_ISSUER`              | Required expected issuer; local `weekly-report-api`            |
| `JWT_AUDIENCE`            | Required expected audience; local `weekly-report-frontend`     |
| `CORS_ORIGINS`            | Comma-separated exact frontend origins; no wildcard or paths   |
| `CORS_ORIGN`              | Existing misspelled setting retained as a fallback             |
| `COOKIE_SECURE`           | Defaults to true; local setup explicitly sets false            |
| `COOKIE_SAME_SITE`        | `lax` by default; `none` only with Secure                      |
| `ACCESS_TOKEN_SECONDS`    | 900; integer 1–3600                                            |
| `REFRESH_SESSION_SECONDS` | 604800; integer 60–2592000; absolute lifetime                  |
| `PASSWORD_MIN_LENGTH`     | 15; configurable from 15 to 128                                |
| `PASSWORD_MAX_LENGTH`     | 128; at least the minimum, no more than 1024                   |
| `AUTH_TEST_DATABASE_URL`  | Optional local test DB override; migrations must already exist |

HS256 is explicitly allowlisted for signing and verification. JWTs contain `sub`
and `sid` plus issuer, audience, issue time and required expiry. Role/permission
claims are not trusted from JWTs. Invalid/missing signing configuration stops
startup. A different deployment must provide its own secret through environment
configuration; never reuse or commit this workspace's local secret.

## Cookies, origins and browser usage

The cookie is named `refreshToken`, HttpOnly, Path `/api/v1/auth`, with no Domain.
Login and refresh set it for the remaining absolute session lifetime. Logout and
successful password change clear it with matching Path/Secure/SameSite and
Max-Age=0. Its raw value never appears in JSON.

For HTTPS deployments, set `COOKIE_SECURE=true` and exact HTTPS frontend origins.
Use SameSite=Lax for same-site deployments. When the frontend and API are
cross-site, use `COOKIE_SAME_SITE=none` with Secure. Strict server-side Origin
validation remains mandatory in either configuration and rejects absent, `null`
and unlisted origins; CORS alone is not used as CSRF protection. Local insecure
cookies/HTTP origins are allowed only with `NODE_ENV=development` and loopback
frontend origins. No trust-proxy behavior was added; deployments behind a proxy
must configure trusted proxy addresses deliberately before relying on client-IP
rate limits. Browser third-party-cookie restrictions may still prevent cross-site
cookies; prefer a same-site deployment when possible.

Frontend login example:

```ts
const response = await fetch('http://localhost:3001/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { data } = await response.json(); // handle non-2xx using the error envelope
// Keep data.accessToken in memory; never persist the refresh token in JS storage.
```

After reload, restore authentication using a POST to `/api/v1/auth/refresh` with
`credentials: 'include'` and **no body**. Store the returned access token and user
in memory. Use `Authorization: Bearer <accessToken>` for protected calls. A failed
refresh requires returning to login.

Coordinate refresh attempts through one shared frontend promise and across tabs
where applicable. Only one concurrent request using an old cookie can win; an
old token becomes invalid immediately after rotation. A lost refresh response
can require a fresh login because the old token cannot recover the replacement.
This schema stores only the current token hash; **it does not provide token-family
replay detection**. Logout works independently of access-token expiry.

## Transactions and future services

Passwords use Argon2id with 64 MiB, three iterations and parallelism one. Refresh
tokens are 32 random bytes encoded as base64url; only SHA-256 hashes are stored.
Each login creates a distinct session. Rotation changes its hash and last-used
time without extending expiry.

Every login/session/password/activation mutation acquires the same user's row
lock first, reads current state again and then writes within a READ COMMITTED
transaction. Login/password change verify/hash outside the transaction, then
compare the stored password hash after taking the lock. Thus a stale password
verification cannot leave a newly created session alive after a password change.
Refresh rechecks the original hash and uses a conditional update. Password change
atomically replaces the password and revokes every session, including its own.
The role row is also share-locked while the transaction checks its current state.

Invitation acceptance additionally locks and revalidates the invitation, consumes
it conditionally, and writes only explicitly allowed profile fields. It preserves
the assigned company email and role. Reporting eligibility uses the current
Monday in Asia/Colombo: a spanning initial planned interval moves forward to that
week, future manager-selected intervals stay unchanged, and fully elapsed plans
for the never-activated user are removed. It does not invent a new open-ended
obligation after an expired finite schedule. Activated accounts cannot use this
flow, so completed activation history is not rewritten. No automatic login occurs.

Later Users/invitation services must follow the same user-first locking order for
password changes, deactivation, role reassignment, invitation issuance/consumption
and reporting-period changes. Existing database constraints remain the final
backstop. Locks cannot serialize external writers that ignore the protocol.

Reusable infrastructure is exported from AuthModule:

- `JwtAuthGuard`/Passport strategy verify the current user, active role and owned,
  unexpired, unrevoked session on every protected request.
- `@CurrentUser()` returns a typed context with current role and permissions.
- `@Roles(...)`, `@Permissions.all(...)` and `@Permissions.any(...)` express route
  requirements. `@Authorize()` applies JWT, role and permission guards in order.
- Manager roles do not bypass permission checks. Guards do not grant ownership
  or team access; future services must enforce those branches separately.

Global throttling is retained at 100 requests/minute per route/tracker. Login,
invitation check and acceptance override it to 10/minute. The existing in-memory
storage is appropriate to this local single-process stage; multiple API replicas
would need a shared limiter. No production test endpoints were added.

## Files and verification

- `src/auth/`: controller, service, DTOs, Passport strategy, JWT guard, typed
  current-user context, role/permission guards and request/cookie helpers.
- `src/common/`: envelope interceptor, safe error filter, validation error mapping
  and Swagger response decorators.
- `src/config/auth.config.ts`, `src/configure-app.ts`, `src/main.ts` and
  `src/app.module.ts`: validated settings and shared application setup.
- `src/prisma/prisma.module.ts` and `prisma.service.ts`: exported single provider
  and shutdown disconnect; no schema/migration changes.
- `scripts/setup-local-auth.cjs`, `.env.example`, package files and README:
  local setup, required compatible packages, commands and documentation.
- `test/auth/auth.integration.cjs`, `test/app.e2e-spec.ts` and
  `test/jest-e2e.json`: focused auth verification and existing starter-test alignment.

New packages: @nestjs/passport 11.0.5, @nestjs/jwt 11.0.2, Passport 0.7.0,
passport-jwt 4.0.1, Argon2 0.45.1, class-validator 0.15.1, class-transformer 0.5.1,
cookie-parser 1.4.7 and their needed types. Existing installed package versions
were preserved, including Nest 11.1.28 and Prisma 7.9.1. Configuration follows the
official [Nest Passport/authentication documentation](https://docs.nestjs.com/security/authentication),
[validation documentation](https://docs.nestjs.com/techniques/validation),
[throttler documentation](https://docs.nestjs.com/security/rate-limiting) and
[node-argon2 documentation](https://github.com/ranisalt/node-argon2).

Run:

```sh
npm run type-check
npm run build
npm test -- --runInBand
npm run test:e2e
npm run test:auth
npm run db:status
```

`test:auth` builds and runs 20 real HTTP/PostgreSQL tests against a local database
with the existing migration applied. It uses ephemeral signing settings and
random UUID fixtures, then deletes only its recorded fixture IDs. It does not
reset/drop a schema, create public fixture routes or send emails. Use
`AUTH_TEST_DATABASE_URL` for an already migrated dedicated local test database;
otherwise the local `DATABASE_URL` is used. The runner refuses remote hosts and
production mode. If interrupted, its generated fixture IDs may remain; never
perform broad cleanup against unrelated application rows.

Coverage includes exact response/cookie shapes, all credentials/account states,
JWT validation and current grant changes, all/any guards, origin rejection,
refresh/acceptance races, stale-login/password-change serialization, logout
fallbacks and infrastructure errors, strict DTOs, reporting eligibility,
Swagger and throttling. Existing Jest unit and e2e tests also pass. Formatting,
type checks, build and targeted ESLint are part of the final checks; the current
ESLint base `no-unused-vars` rule emits false-positive warnings for TypeScript
constructor parameter properties and function signatures, while the TypeScript
unused-variable rule remains enabled.

This stage ends at authentication. Users CRUD, role/permission provisioning,
invitation creation/resend/delivery, project/task/report features, dashboards,
notifications, frontend screens, signup and password recovery are deferred.
