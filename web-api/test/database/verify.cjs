// Database-only verification. All fixture writes and replay DDL are rolled back.
require('dotenv/config');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const contract = require('./schema-contract.json');

const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const signature = (value) => JSON.stringify(value);
const sort = (values) => values.map(signature).sort();
const normalizeType = (type) =>
  type
    .replace('character varying', 'varchar')
    .replace('character', 'char')
    .replace('timestamp(6) with time zone', 'timestamptz')
    .replace('timestamp with time zone', 'timestamptz');
const normalizePredicate = (value) =>
  value?.replace(/[()"\s]/g, '').toLowerCase() ?? null;

// Additional query indexes from the Markdown specification; PK/UNIQUE indexes
// are checked separately against the structural contract copied from DBML.
const queryIndexes = {
  role_permissions: ['permission_id'],
  users: ['role_id', 'created_at DESC, id DESC'],
  auth_sessions: ['user_id', 'expires_at'],
  user_invitations: [
    'user_id, created_at DESC',
    'invited_by',
    'email_delivery_status, created_at',
  ],
  projects: ['archived_at, name, id'],
  tasks: [
    'assignee_id, planned_date, id',
    'project_id, planned_date, id',
    'planned_date, id',
    'created_by',
  ],
  task_time_entries: ['task_id, work_date', 'user_id, work_date, id'],
  reports: ['week_start, status, member_id', 'member_id, week_start DESC, id'],
  report_versions: [
    ['report_id, submitted_at DESC', 'submitted_at IS NOT NULL'],
  ],
  report_tasks: [
    'report_version_id',
    'project_id',
    ['source_task_id', 'source_task_id IS NOT NULL'],
  ],
  report_blockers: ['report_version_id'],
  report_achievements: ['report_version_id'],
  report_reviews: ['reviewer_id, created_at DESC', 'created_at DESC, id DESC'],
  notifications: [
    'recipient_id, created_at DESC, id DESC',
    ['recipient_id, created_at DESC, id DESC', 'read_at IS NULL'],
    'actor_id',
    'report_version_id',
    'report_review_id, report_version_id',
    'task_id',
  ],
};
const partialUnique = {
  user_invitations: [['user_id', 'consumed_at IS NULL AND revoked_at IS NULL']],
  report_versions: [['report_id', 'submitted_at IS NULL']],
  report_tasks: [
    [
      'report_version_id, source_task_id, section',
      'source_task_id IS NOT NULL',
    ],
  ],
  report_blockers: [['report_version_id', 'is_key = true']],
  report_achievements: [['report_version_id', 'is_key = true']],
};

async function inspect(client, schema) {
  const tables = (
    await client.query(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename <> $2',
      [schema, '_prisma_migrations'],
    )
  ).rows.map((r) => r.tablename);
  assert.deepEqual(
    tables.sort(),
    Object.keys(contract.tables).sort(),
    'exactly the 17 specified tables',
  );
  const columns = (
    await client.query(
      `SELECT c.relname AS table_name, a.attname AS name,
    format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS required,
    pg_get_expr(d.adbin,d.adrelid) AS default
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=$1 AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY a.attnum`,
      [schema],
    )
  ).rows;
  for (const [name, table] of Object.entries(contract.tables)) {
    const actual = columns
      .filter((c) => c.table_name === name)
      .map(({ table_name, ...c }) => ({
        ...c,
        type: normalizeType(c.type),
        default:
          c.default === 'CURRENT_TIMESTAMP'
            ? 'now()'
            : (c.default?.replace(/^'([^']*)'::.*$/, '$1') ?? null),
      }));
    assert.deepEqual(
      actual,
      table.columns,
      `${name}: column types, order, nullability and defaults`,
    );
  }
  const enums = (
    await client.query(
      `SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values
    FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname=$1 GROUP BY t.typname`,
      [schema],
    )
  ).rows;
  assert.deepEqual(
    Object.fromEntries(enums.map((e) => [e.typname, e.values])),
    contract.enums,
    'enum names and ordered values',
  );

  const constraints = (
    await client.query(
      `SELECT c.relname AS table_name, con.conname AS name, con.contype AS type,
    con.confdeltype, con.confupdtype, parent.relname AS parent,
    ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=con.confrelid AND a.attnum=k.num ORDER BY k.ord) AS references
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_class parent ON parent.oid=con.confrelid
    WHERE n.nspname=$1 AND c.relname <> '_prisma_migrations'`,
      [schema],
    )
  ).rows;
  const fks = constraints.filter((c) => c.type === 'f');
  assert(
    fks.every((c) => c.confdeltype === 'r' && c.confupdtype === 'r'),
    'all FKs use RESTRICT/RESTRICT',
  );
  assert.deepEqual(
    sort(
      fks.map((c) => ({
        table: c.table_name,
        columns: c.columns,
        parent: c.parent,
        references: c.references,
      })),
    ),
    sort(contract.foreignKeys),
    'all 27 FKs including review/version consistency',
  );
  for (const [name, table] of Object.entries(contract.tables)) {
    assert.deepEqual(
      constraints.find((c) => c.table_name === name && c.type === 'p')?.columns,
      table.primaryKey,
      `${name} primary key`,
    );
  }
  assert.equal(
    constraints.filter((c) => c.type === 'x').length,
    1,
    'one exclusion constraint',
  );
  assert(
    constraints.some(
      (c) => c.name === 'user_reporting_periods_no_overlap' && c.type === 'x',
    ),
  );

  const indexes = (
    await client.query(
      `SELECT c.relname AS table_name, i.indisunique AS unique, i.indisprimary AS primary,
    i.indisexclusion AS exclusion, i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition,
    pg_get_expr(i.indpred,i.indrelid) AS predicate
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname <> '_prisma_migrations'`,
      [schema],
    )
  ).rows;
  const expected = [];
  for (const [name, table] of Object.entries(contract.tables)) {
    for (const columns of table.unique)
      expected.push([name, true, columns.join(', '), null]);
    for (const index of queryIndexes[name] ?? []) {
      const [columns, predicate] = Array.isArray(index) ? index : [index, null];
      expected.push([name, false, columns, normalizePredicate(predicate)]);
    }
    for (const [columns, predicate] of partialUnique[name] ?? [])
      expected.push([name, true, columns, normalizePredicate(predicate)]);
  }
  assert(
    indexes.every((i) => i.valid),
    'all indexes valid',
  );
  const actualIndexes = indexes
    .filter((i) => !i.primary && !i.exclusion)
    .map((i) => [
      i.table_name,
      i.unique,
      i.definition.match(/USING btree \(([^)]+)\)/)[1].replaceAll('"', ''),
      normalizePredicate(i.predicate),
    ]);
  assert.deepEqual(
    sort(actualIndexes),
    sort(expected),
    'exact index columns, order, predicates and uniqueness; no extras',
  );
  console.log(
    `Catalog passed: ${tables.length} tables, ${columns.filter((c) => tables.includes(c.table_name)).length} columns, ${enums.length} enums, ${fks.length} foreign keys, ${indexes.length} indexes.`,
  );
  return constraints.filter((c) => c.type === 'c').map((c) => c.name);
}

async function exercise(client, checks) {
  const covered = new Set();
  let assertions = 0;
  const insert = async (table, data) => {
    const row = { id: randomUUID(), ...data };
    const keys = Object.keys(row);
    await client.query(
      `INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
      Object.values(row),
    );
    return row;
  };
  const reject = async (label, code, constraint, action) => {
    await client.query('SAVEPOINT rejection');
    let failure;
    try {
      await action();
    } catch (error) {
      failure = error;
    }
    await client.query('ROLLBACK TO SAVEPOINT rejection');
    await client.query('RELEASE SAVEPOINT rejection');
    if (Array.isArray(code)) assert(code.includes(failure?.code), label);
    else assert.equal(failure?.code, code, label);
    if (constraint) {
      assert.equal(
        failure?.constraint,
        constraint,
        `${label}: correct constraint`,
      );
      covered.add(constraint);
    }
    assertions++;
  };
  const update = async (table, id, changes) => {
    const keys = Object.keys(changes);
    await client.query(
      `UPDATE ${quote(table)} SET ${keys.map((k, i) => `${quote(k)}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1}`,
      [...Object.values(changes), id],
    );
  };
  const invalid = (table, row, constraint, changes) =>
    reject(constraint, '23514', constraint, () =>
      update(table, row.id, changes),
    );
  const start = '2026-09-07T00:00:00Z',
    before = '2026-09-06T00:00:00Z',
    later = '2026-09-08T00:00:00Z';
  const role = await insert('roles', {
    code: randomUUID(),
    name: 'Verification role',
  });
  const member = await insert('users', {
    role_id: role.id,
    employee_id: randomUUID().slice(0, 30),
    first_name: 'Test',
    last_name: 'Member',
    email: `${randomUUID()}@example.invalid`,
    created_at: start,
  });
  const other = await insert('users', {
    role_id: role.id,
    employee_id: randomUUID().slice(0, 30),
    first_name: 'Test',
    last_name: 'Other',
    email: `${randomUUID()}@example.invalid`,
    created_at: start,
  });
  const project = await insert('projects', {
    name: 'Verification project',
    start_date: '2026-09-07',
  });
  const task = await insert('tasks', {
    created_by: member.id,
    assignee_id: member.id,
    project_id: project.id,
    name: 'Verification task',
    planned_date: '2026-09-07',
    created_at: start,
  });
  const time = await insert('task_time_entries', {
    task_id: task.id,
    user_id: member.id,
    work_date: '2026-09-07',
    minutes: 1,
  });
  const report = await insert('reports', {
    member_id: member.id,
    week_start: '2026-09-07',
  });
  const submitted = await insert('report_versions', {
    report_id: report.id,
    version_number: 1,
    created_at: start,
    submitted_at: later,
  });
  const draft = await insert('report_versions', {
    report_id: report.id,
    version_number: 2,
    created_at: start,
  });
  const snapshot = await insert('report_tasks', {
    report_version_id: draft.id,
    section: 'THIS_WEEK',
    name: 'Snapshot',
    display_order: 0,
  });
  const blocker = await insert('report_blockers', {
    report_version_id: draft.id,
    description: 'Blocker',
    is_key: true,
    display_order: 0,
  });
  const achievement = await insert('report_achievements', {
    report_version_id: draft.id,
    description: 'Achievement',
    is_key: true,
    display_order: 0,
  });
  const review = await insert('report_reviews', {
    report_version_id: submitted.id,
    reviewer_id: other.id,
    decision: 'APPROVED',
  });
  const noticeData = {
    recipient_id: member.id,
    actor_id: other.id,
    event_key: randomUUID(),
    type: 'REPORT_APPROVED',
    report_version_id: submitted.id,
    report_review_id: review.id,
    title: 'Review',
    message: 'Approved',
    created_at: start,
  };
  const notice = await insert('notifications', noticeData);
  const session = await insert('auth_sessions', {
    user_id: member.id,
    refresh_token_hash: 'a'.repeat(64),
    created_at: start,
    expires_at: later,
  });
  const invitation = await insert('user_invitations', {
    user_id: member.id,
    invited_by: other.id,
    token_hash: 'b'.repeat(64),
    created_at: start,
    expires_at: later,
  });
  const period = await insert('user_reporting_periods', {
    user_id: member.id,
    start_week: '2026-09-07',
    end_week: '2026-09-14',
  });

  const cases = [
    ['roles', role, 'roles_name_nonblank_check', { name: ' \t\n' }],
    ['users', member, 'users_first_name_nonblank_check', { first_name: ' ' }],
    ['users', member, 'users_last_name_nonblank_check', { last_name: '\t' }],
    ['users', member, 'users_email_nonblank_check', { email: '' }],
    [
      'users',
      member,
      'users_email_normalized_check',
      { email: ' Upper@EXAMPLE.invalid ' },
    ],
    [
      'users',
      member,
      'users_activation_password_check',
      { password_hash: 'test-only-hash' },
    ],
    [
      'users',
      member,
      'users_activation_password_check',
      { activated_at: later },
    ],
    [
      'users',
      member,
      'users_activation_date_check',
      { activated_at: before, password_hash: 'test-only-hash' },
    ],
    [
      'users',
      member,
      'users_deactivation_date_check',
      { deactivated_at: before },
    ],
    [
      'user_reporting_periods',
      period,
      'user_reporting_periods_start_monday_check',
      { start_week: '2026-09-08' },
    ],
    [
      'user_reporting_periods',
      period,
      'user_reporting_periods_end_monday_check',
      { end_week: '2026-09-15' },
    ],
    [
      'auth_sessions',
      session,
      'auth_sessions_token_hash_check',
      { refresh_token_hash: 'A'.repeat(64) },
    ],
    [
      'auth_sessions',
      session,
      'auth_sessions_token_hash_check',
      { refresh_token_hash: 'a'.repeat(63) },
    ],
    [
      'auth_sessions',
      session,
      'auth_sessions_expiry_check',
      { expires_at: start },
    ],
    [
      'auth_sessions',
      session,
      'auth_sessions_last_used_check',
      { last_used_at: before },
    ],
    [
      'auth_sessions',
      session,
      'auth_sessions_revoked_check',
      { revoked_at: before },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_token_hash_check',
      { token_hash: 'g'.repeat(64) },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_token_hash_check',
      { token_hash: 'b'.repeat(63) },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_expiry_check',
      { expires_at: start },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_consumed_date_check',
      { consumed_at: before },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_consumed_date_check',
      { consumed_at: later },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_revoked_date_check',
      { revoked_at: before },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_email_sent_date_check',
      { email_sent_at: before },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_state_check',
      { consumed_at: start, revoked_at: start },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_attempt_count_check',
      { email_attempt_count: -1 },
    ],
    [
      'user_invitations',
      invitation,
      'user_invitations_sent_check',
      { email_delivery_status: 'SENT' },
    ],
    ['projects', project, 'projects_name_nonblank_check', { name: ' ' }],
    [
      'projects',
      project,
      'projects_date_order_check',
      { end_date: '2026-09-06' },
    ],
    ['tasks', task, 'tasks_name_nonblank_check', { name: ' ' }],
    ['tasks', task, 'tasks_due_date_check', { due_date: '2026-09-06' }],
    [
      'tasks',
      task,
      'tasks_planned_completion_check',
      { planned_completion_pct: -0.01 },
    ],
    [
      'tasks',
      task,
      'tasks_actual_completion_check',
      { actual_completion_pct: 100.01 },
    ],
    ['tasks', task, 'tasks_planned_minutes_check', { planned_minutes: -1 }],
    ['tasks', task, 'tasks_lock_version_check', { lock_version: 0 }],
    [
      'tasks',
      task,
      'tasks_completion_check',
      { status: 'COMPLETED', actual_completion_pct: 100 },
    ],
    [
      'tasks',
      task,
      'tasks_completion_check',
      { status: 'COMPLETED', completed_at: later },
    ],
    ['tasks', task, 'tasks_completion_check', { completed_at: later }],
    [
      'task_time_entries',
      time,
      'task_time_entries_minutes_check',
      { minutes: 0 },
    ],
    [
      'task_time_entries',
      time,
      'task_time_entries_minutes_check',
      { minutes: 1441 },
    ],
    [
      'reports',
      report,
      'reports_week_monday_check',
      { week_start: '2026-09-08' },
    ],
    [
      'report_versions',
      draft,
      'report_versions_number_check',
      { version_number: 0 },
    ],
    [
      'report_versions',
      draft,
      'report_versions_lock_version_check',
      { lock_version: 0 },
    ],
    [
      'report_versions',
      draft,
      'report_versions_submitted_date_check',
      { submitted_at: before },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_name_nonblank_check',
      { name: ' ' },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_planned_completion_check',
      { planned_completion_pct: 100.01 },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_actual_completion_check',
      { actual_completion_pct: -0.01 },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_planned_minutes_check',
      { planned_minutes: -1 },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_actual_minutes_check',
      { actual_minutes: -1 },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_display_order_check',
      { display_order: -1 },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_next_week_check',
      { section: 'NEXT_WEEK', status: 'NOT_STARTED' },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_next_week_check',
      { section: 'NEXT_WEEK', actual_minutes: 0 },
    ],
    [
      'report_tasks',
      snapshot,
      'report_tasks_next_week_check',
      { section: 'NEXT_WEEK', actual_completion_pct: 0 },
    ],
    [
      'report_blockers',
      blocker,
      'report_blockers_description_nonblank_check',
      { description: ' \n' },
    ],
    [
      'report_blockers',
      blocker,
      'report_blockers_display_order_check',
      { display_order: -1 },
    ],
    [
      'report_achievements',
      achievement,
      'report_achievements_description_nonblank_check',
      { description: '\t' },
    ],
    [
      'report_achievements',
      achievement,
      'report_achievements_display_order_check',
      { display_order: -1 },
    ],
    [
      'report_reviews',
      review,
      'report_reviews_correction_comment_check',
      { decision: 'CHANGES_REQUESTED', comment: null },
    ],
    [
      'report_reviews',
      review,
      'report_reviews_correction_comment_check',
      { decision: 'CHANGES_REQUESTED', comment: ' \t' },
    ],
    [
      'notifications',
      notice,
      'notifications_title_nonblank_check',
      { title: ' ' },
    ],
    [
      'notifications',
      notice,
      'notifications_message_nonblank_check',
      { message: '\n' },
    ],
    [
      'notifications',
      notice,
      'notifications_read_date_check',
      { read_at: before },
    ],
  ];
  for (const args of cases) await invalid(...args);
  // The date-order CHECK rejects reversed endpoints before GiST index insertion.
  await reject(
    'reversed reporting period',
    '23514',
    'user_reporting_periods_date_order_check',
    () =>
      update('user_reporting_periods', period.id, { end_week: '2026-08-31' }),
  );

  // All eight target-presence combinations for each notification type.
  for (const type of contract.enums.notification_type) {
    for (let bits = 0; bits < 8; bits++) {
      const valid =
        type === 'TASK_ASSIGNED'
          ? bits === 1
          : ['REPORT_APPROVED', 'REPORT_NEEDS_CORRECTION'].includes(type)
            ? bits === 6
            : bits === 4;
      const data = {
        ...noticeData,
        event_key: randomUUID(),
        type,
        report_version_id: bits & 4 ? submitted.id : null,
        report_review_id: bits & 2 ? review.id : null,
        task_id: bits & 1 ? task.id : null,
      };
      if (valid) {
        await insert('notifications', data);
        assertions++;
      } else
        await reject(
          `notification target ${type}/${bits}`,
          '23514',
          'notifications_target_check',
          () => insert('notifications', data),
        );
    }
  }
  await reject(
    'mismatched review/version',
    '23503',
    'notifications_review_version_fkey',
    () => update('notifications', notice.id, { report_version_id: draft.id }),
  );
  await reject(
    'notification recipient/event duplicate',
    '23505',
    'notifications_recipient_id_event_key_key',
    () => insert('notifications', noticeData),
  );
  await insert('notifications', { ...noticeData, recipient_id: other.id });
  await reject(
    'overlap at inclusive endpoint',
    '23P01',
    'user_reporting_periods_no_overlap',
    () =>
      insert('user_reporting_periods', {
        user_id: member.id,
        start_week: '2026-09-14',
        end_week: '2026-09-21',
      }),
  );
  await insert('user_reporting_periods', {
    user_id: member.id,
    start_week: '2026-09-21',
  });
  await reject(
    'open-ended overlap',
    '23P01',
    'user_reporting_periods_no_overlap',
    () =>
      insert('user_reporting_periods', {
        user_id: member.id,
        start_week: '2026-10-05',
      }),
  );
  await insert('user_reporting_periods', {
    user_id: other.id,
    start_week: '2026-09-07',
  });
  await reject(
    'expired outstanding invitation still unique',
    '23505',
    'user_invitations_outstanding_key',
    () =>
      insert('user_invitations', {
        ...invitation,
        id: randomUUID(),
        token_hash: 'c'.repeat(64),
      }),
  );
  await update('user_invitations', invitation.id, { revoked_at: start });
  await insert('user_invitations', {
    ...invitation,
    id: randomUUID(),
    token_hash: 'c'.repeat(64),
  });
  await reject(
    'one editable version',
    '23505',
    'report_versions_editable_key',
    () =>
      insert('report_versions', { report_id: report.id, version_number: 3 }),
  );
  await insert('report_versions', {
    report_id: report.id,
    version_number: 3,
    created_at: start,
    submitted_at: later,
  });
  for (const [table, row, constraint] of [
    ['report_blockers', blocker, 'report_blockers_key_item_key'],
    ['report_achievements', achievement, 'report_achievements_key_item_key'],
  ]) {
    await reject('one key item', '23505', constraint, () =>
      insert(table, { ...row, id: randomUUID() }),
    );
    await insert(table, { ...row, id: randomUUID(), is_key: false });
    await insert(table, { ...row, id: randomUUID(), is_key: false });
  }
  const imported = { ...snapshot, id: randomUUID(), source_task_id: task.id };
  await insert('report_tasks', imported);
  await reject('duplicate import', '23505', 'report_tasks_imported_key', () =>
    insert('report_tasks', { ...imported, id: randomUUID() }),
  );
  await insert('report_tasks', {
    ...imported,
    id: randomUUID(),
    section: 'NEXT_WEEK',
  });
  await insert('report_tasks', { ...snapshot, id: randomUUID() });
  await update('tasks', task.id, {
    status: 'COMPLETED',
    actual_completion_pct: 100,
    completed_at: later,
  });
  await update('report_tasks', snapshot.id, {
    planned_completion_pct: 0,
    actual_completion_pct: 100,
    planned_minutes: 0,
    actual_minutes: 0,
  });
  await update('task_time_entries', time.id, { minutes: 1440 });
  // Per-day totals, ownership and workflow immutability are intentionally deferred.
  await insert('task_time_entries', {
    ...time,
    id: randomUUID(),
    minutes: 1440,
  });
  await update('users', member.id, {
    activated_at: start,
    password_hash: 'test-only-hash',
  });
  await update('report_reviews', review.id, {
    decision: 'CHANGES_REQUESTED',
    comment: 'Please correct this report.',
  });
  await update('user_invitations', invitation.id, {
    email_delivery_status: 'SENT',
    email_sent_at: start,
  });
  await reject(
    'restrict referenced task deletion',
    ['23001', '23503'],
    null,
    () => client.query('DELETE FROM tasks WHERE id=$1', [task.id]),
  );
  await reject(
    'restrict referenced task ID update',
    ['23001', '23503'],
    null,
    () => update('tasks', task.id, { id: randomUUID() }),
  );
  assert.deepEqual(
    checks.filter((c) => !covered.has(c)),
    [],
    'every CHECK tested with a rejecting case',
  );
  console.log(
    `Constraint checks passed: ${assertions} assertions, all ${checks.length} CHECK constraints exercised, plus valid nullable/boundary cases.`,
  );
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      process.env.NODE_ENV !== 'production',
    'Verification requires a local development DATABASE_URL.',
  );
  const replay = process.argv.includes('--replay');
  const target = url.searchParams.get('schema') ?? 'public';
  const schema = replay
    ? `stage1_verify_${randomUUID().replaceAll('-', '')}`
    : target;
  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    if (replay) await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query("SELECT set_config('search_path', $1, true)", [
      `${quote(schema)}, public`,
    ]);
    if (replay) {
      const directory = path.resolve(__dirname, '../../prisma/migrations');
      for (const entry of fs.readdirSync(directory).sort()) {
        const file = path.join(directory, entry, 'migration.sql');
        if (fs.existsSync(file)) {
          const sql = fs.readFileSync(file, 'utf8');
          // This harness is for the reviewed Stage 1 SQL chain. Fail closed if
          // future migrations could escape its rollback or isolated search_path.
          assert(
            !/^\s*(BEGIN|COMMIT|END|ROLLBACK|START\s+TRANSACTION|DROP\s+(DATABASE|SCHEMA))\b/im.test(
              sql,
            ),
            'Replay requires transaction-neutral, nondestructive migration SQL.',
          );
          const unqualified = sql.replace(
            /^CREATE SCHEMA IF NOT EXISTS "task_manager";\s*$/m,
            '',
          );
          assert(
            !/\btask_manager\b/.test(unqualified),
            'Review schema-qualified SQL before isolated replay.',
          );
          await client.query(sql);
        }
      }
      console.log(
        'Migration chain replayed in a new isolated schema inside the rollback transaction.',
      );
    }
    const checks = await inspect(client, schema);
    await exercise(client, checks);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
  console.log(
    'Verification rolled back; no fixtures or replay schema retained.',
  );
}
main().catch((error) => {
  // PostgreSQL errors may contain row values: only print code/constraint.
  console.error(
    error.code === 'ERR_ASSERTION'
      ? error.message
      : `Database verification failed (${error.code ?? error.name}; ${error.constraint ?? 'no constraint'}).`,
  );
  process.exitCode = 1;
});
