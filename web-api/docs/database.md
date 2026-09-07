# Stage 1 database

Implemented from the supplied **weekly-report-schema.md, Revision 2 (7 September 2026)** and `weekly-report-schema.dbml`. The Markdown governs constraints, query
indexes and service boundaries. No application workflows or seeds are included.

Files delivered:

- `prisma/schema.prisma`: all models, enums, relations and supported indexes.
- `prisma/migrations/20260907120000_initial_weekly_reporting/migration.sql`
  and `prisma/migrations/migration_lock.toml`: the initial PostgreSQL migration.
- `src/prisma/prisma.service.ts` and `src/prisma/prisma.service.spec.ts`:
  runtime schema selection and the test's configuration provider.
- `package.json` and `package-lock.json`: database commands, Jest resolution and
  explicit existing-version verifier dependencies.
- `test/database/schema-contract.json`, `test/database/verify.cjs` and
  `test/database/client-smoke.cjs`: specification contract and rollback checks.
- `.env.example`, `README.md` and `docs/database.md`: safe setup and review notes.

The existing `src/app.module.ts` working-tree changes predated Stage 1 and were
not edited during this implementation.

## Local setup

The existing npm lockfile is retained. Verified versions: Node 24.16.0, NestJS
11.1.28, Prisma CLI/Client/adapter 7.9.1, TypeScript 5.9.3, node-postgres 8.23.0
and PostgreSQL 18.4. `dotenv` 17.4.1 and `pg` 8.23.0 are now explicit development
dependencies at their previously installed versions, for CLI configuration and
the database verifier. No existing dependency version was upgraded.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` **only if `.env` does not already exist**. Replace
   its placeholders with your local database credentials. URL-encode special
   characters in the password. Do not commit `.env` or print the connection URL.
3. Use an existing local development database with an empty `task_manager`
   schema. The database itself must already exist. The migration creates the
   schema and requires permission to install `btree_gist` in `public`. If that
   extension already exists elsewhere, have the database administrator review
   its placement before applying: the exclusion uses `public.gist_uuid_ops`.
4. Run the following from the project root:

   ```sh
   npm run db:validate
   npm run db:migrate
   npm run db:generate
   npm run type-check
   npm run build
   npm run db:status
   npm run db:verify
   npm run db:verify:replay
   npm run db:verify:client
   ```

On Windows PowerShell with blocked `.ps1` wrappers, use `npm.cmd` and `npx.cmd`.
The direct CLI equivalent is `node node_modules/prisma/build/index.js <command>`.
Do not change execution policy just to run the commands.

The runtime adapter explicitly reads `?schema=` from `DATABASE_URL`, matching
Prisma Migrate's target; it defaults to `public` when omitted. The Stage 1
migration was generated for `task_manager`, so retain that URL setting for this
project. The generated CommonJS client remains in ignored `generated/prisma`.
Jest resolves its relative `.js` imports to the generated TypeScript sources.

## Model mappings

| Prisma model        | PostgreSQL table       |
| ------------------- | ---------------------- |
| Role                | roles                  |
| Permission          | permissions            |
| RolePermission      | role_permissions       |
| User                | users                  |
| UserReportingPeriod | user_reporting_periods |
| AuthSession         | auth_sessions          |
| UserInvitation      | user_invitations       |
| Project             | projects               |
| Task                | tasks                  |
| TaskTimeEntry       | task_time_entries      |
| Report              | reports                |
| ReportVersion       | report_versions        |
| ReportTask          | report_tasks           |
| ReportBlocker       | report_blockers        |
| ReportAchievement   | report_achievements    |
| ReportReview        | report_reviews         |
| Notification        | notifications          |

Fields use camelCase with `@map` where the column differs; models and the nine
PascalCase enums use `@@map` to preserve database names. Enum values are unchanged.
All 153 columns retain the specified nullability, lengths and native types:
UUID, date, timestamptz(6), numeric(5,2), char(64), varchar and text.

`@default(uuid())` generates IDs in Prisma Client; there is **no SQL UUID default
or UUID extension**. SQL writers must supply their own UUIDs. Every `updated_at`
has an insert default of `CURRENT_TIMESTAMP` plus application-side `@updatedAt`;
raw SQL writers must explicitly maintain it. There are no update triggers.
JavaScript `Date` has millisecond precision even though PostgreSQL retains
microseconds. Treat date-only fields as calendar dates (UTC-midnight `Date`
values at the client boundary); apply the fixed Asia/Colombo weekly policy in
later services.

All 27 foreign keys use `ON DELETE RESTRICT ON UPDATE RESTRICT`. RolePermission
has its composite primary key. Relations with multiple roles have explicit
names. ReportTask contains independent weekly snapshots and an optional live
task reference; it does not inherit live task changes.

## PostgreSQL constraints and client limits

The initial migration has 53 CHECK constraints and one GiST exclusion, in
addition to primary/unique/foreign keys and 66 total indexes. Prisma 7.9.1
cannot declare CHECK or exclusion constraints, so these are maintained in SQL:

- Nonblank required names/descriptions and notification text; normalized login
  email; activation/password presence consistency and account timestamp order.
- Monday reporting dates, ordered inclusive periods and no per-user overlap
  using `daterange(start_week, end_week, '[]')`, including an unbounded NULL end.
  `btree_gist` supplies UUID equality for the exclusion.
- Session/invitation expiry and timestamp ordering, 64-character lowercase hex
  hashes, invitation state exclusivity, nonnegative attempts, and SENT timestamps.
- Project/task date order, percentage/time bounds, positive version counters,
  task completion consistency, snapshot display order and NEXT_WEEK actuals.
- Submission timestamp order, nonblank correction comments, notification read
  timestamp order and all five event types' permitted target combinations.

SQL CHECKs permit NULL only where the dictionary permits it. For example, draft
snapshot values may be absent; a CHANGES_REQUESTED review must have a non-NULL,
nonblank comment. Required human text rejects whitespace-only strings, including
tabs/newlines. The company-email normalization expression remains the specified
`email = lower(btrim(email))`. Optional descriptions are not made mandatory.

The `partialIndexes` preview feature in the **installed** Prisma version declares
all eight partial indexes: five unique indexes (outstanding invitation, editable
version, imported task, key blocker and key achievement) and three query indexes
(submitted versions, source tasks and unread notifications). Ordinary indexes,
the composite review/version unique key and all notification FKs are also
declared in Prisma; their SQL is generated rather than separately maintained.
See the [official partial-index documentation](https://docs.prisma.io/docs/orm/prisma-schema/data-model/indexes).

Partial uniqueness applies only to rows matching its predicate. The 7.9.1
generated types expose some partial keys in `WhereUniqueInput`; **do not treat
them as unconditional uniqueness**. Query an editable version using
`findFirst({ where: { reportId, submittedAt: null } })`, or an outstanding
invitation with both `consumedAt: null` and `revokedAt: null`. Use the resulting
primary ID for mutations inside the appropriate transaction. An expired but
unrevoked invitation still occupies its unique slot. Handle PostgreSQL constraint
failures in future services; Prisma input types do not validate these SQL rules.

Notifications retain both simple FKs and the additional composite FK. For a
review notification, supply both scalar IDs together, or connect
`reviewVersion` with `{ id_reportVersionId: { id, reportVersionId } }`; this
sets both columns and was verified through the runtime client. The `reportReview`
and `reviewVersion` relation properties refer to the same review row. A matching
review decision for the notification type is still a service check.

## Verification and applied state

Applied migration: `20260907120000_initial_weekly_reporting`.
Target: **local PostgreSQL, localhost:5432, database nest, schema task_manager**.
There was no migration history or table in that schema. Existing `nest_test`
tables and its three migrations were retained. Nothing was reset, dropped or
seeded. No production or remote database was accessed.

Preparation used:

```sh
node node_modules/prisma/build/index.js migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20260907120000_initial_weekly_reporting/migration.sql
```

This generated SQL without database writes. The SQL was inspected, completed
with custom constraints and replayed before `migrate deploy` applied it.

| Check                                    | Result                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Prisma format, validate, generate        | Passed                                                                                            |
| TypeScript check and Nest build          | Passed                                                                                            |
| Prisma service Jest test                 | Passed                                                                                            |
| Migration deploy and status              | Applied; up to date                                                                               |
| Datasource-to-schema diff, `--exit-code` | No difference; exit 0                                                                             |
| Live PostgreSQL catalog                  | 17 tables, 153 columns, 9 enums, 27 FKs, 66 indexes match                                         |
| Constraint behavior                      | 113 assertions; every one of the 53 CHECKs exercised                                              |
| Migration SQL replay                     | Passed in a new isolated schema; transaction rolled back                                          |
| Runtime PrismaService                    | All model mappings, UUID generation, updatedAt, native date/decimal and composite relation passed |

The JSON contract in `test/database` was extracted from the supplied DBML,
independently of the implementation; the query-index list and behavioral checks
come from the Markdown. Tests include all 40 notification target combinations,
NULL/boundary cases, overlapping/unbounded eligibility periods, partial unique
indexes, mismatched review/version links and restricted delete/update behavior.
All fixture writes roll back. Replay uses a fresh schema in the **same local
database**, not a separate database; it also rolls back schema creation. This
avoids creating a database that would need to be dropped. No test fixtures remain.
The replay runner rejects transaction-control and task_manager-qualified SQL
that could escape its isolation; future migration changes may require reviewing
the runner. It is deliberately limited to local development targets.

The runtime check currently emits a node-postgres deprecation warning about an
internal query occurring while another query is executing during relation reads.
It passes on the retained Prisma adapter 7.9.1 / pg 8.23.0 versions. No dependency
upgrade was made to suppress that warning.

## Future migrations

For a future schema change, use `npx prisma migrate dev --create-only --name
<change>` against an isolated development database, review its SQL, add any
required custom SQL, then apply with `npm run db:migrate`. `migrate dev` uses a
disposable shadow database; never configure an existing application database as
that shadow. Stop if Prisma proposes a reset or data loss. This stage used
`migrate diff` to avoid requiring a shadow database.

Never edit this migration after it has been applied; create a new additive or
corrective migration. Keep `migration_lock.toml` and SQL in source control.
Keep the partial-index preview feature enabled while these declarations use it.
Do not use `db push` or regenerate the migration history solely from the Prisma
schema: that would omit the custom CHECK/exclusion constraints and extension.
See Prisma's [unsupported database feature workflow](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features).

Prisma schema diffs do not prove that custom constraints are intact. Review
affected table/column operations for dropped or altered constraints, run catalog
and rejection checks, and replay the complete migration chain. Introspection
may warn about CHECK/exclusion constraints; review its output before replacing
the maintained schema. Re-run `db:generate` and the TypeScript/build checks after
schema changes. Update the specification-based contract only for agreed schema
changes. Deployment roles need the extension already provisioned or permission
to install it.

## Deferred application rules

- Ownership, permissions, manager assignment and last-active-manager protection;
  stable role/permission codes and employee IDs; secure initial-manager provisioning.
- Atomic invitation creation/consumption, acceptance-time expiry, email delivery
  and retries, password hashing, session revocation/rotation, immutable company
  email and one-time activation. No registration or recovery flow is implemented.
- Reporting eligibility adjustments on activation/deactivation/reactivation;
  fixed Monday–Sunday Asia/Colombo weeks and following-Monday noon deadlines.
- Task assignment checks, immutable creator, archive restrictions, historical
  time ownership, rejection of future work dates and serialized per-user/day
  totals of at most 1440 minutes. The database limits each entry, not daily sums.
- Report/version creation together, monotonic version allocation, optimistic
  concurrency, draft locking, submission completeness and frozen project names,
  immutable submitted content/reviews, correction cloning, review state
  transitions, latest-version/self-review rules and private-draft visibility.
- Explicit snapshot imports/refreshes, week-specific time aggregation, notification
  recipients, action-transaction atomicity, review-decision/type matching,
  retry event-key reuse, recipient-only reads and derived dashboard calculations.

There are no unresolved schema mismatches or migration blockers. Stage 1 stops
here for review before implementing services, controllers, authentication,
frontend features or seeds.
