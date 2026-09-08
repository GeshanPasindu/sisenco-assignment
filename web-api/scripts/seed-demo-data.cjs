require('dotenv').config();

const argon2 = require('argon2');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.DEMO_SEED_PASSWORD;

if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!password || Array.from(password).length < 15) {
  throw new Error('Set DEMO_SEED_PASSWORD to a password of at least 15 characters.');
}

const target = new URL(databaseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
if (!localHosts.has(target.hostname) && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error(
    'Demo seeding is blocked for non-local databases. Set ALLOW_DEMO_SEED=true only when you intentionally want demo data in that database.',
  );
}

const schema = target.searchParams.get('schema') ?? 'public';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }, { schema }),
});

const dateOnly = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);
const mondayOf = (date) => {
  const value = dateOnly(date);
  const weekday = value.getUTCDay() || 7;
  return addDays(value, 1 - weekday);
};

const ids = {
  admin: '0b25fe6f-4f88-4bce-91ed-e0e270b35501',
  alice: '0b25fe6f-4f88-4bce-91ed-e0e270b35502',
  ben: '0b25fe6f-4f88-4bce-91ed-e0e270b35503',
  carla: '0b25fe6f-4f88-4bce-91ed-e0e270b35504',
  atlas: '1d25fe6f-4f88-4bce-91ed-e0e270b35501',
  portal: '1d25fe6f-4f88-4bce-91ed-e0e270b35502',
  operations: '1d25fe6f-4f88-4bce-91ed-e0e270b35503',
};

async function main() {
  const [adminRole, memberRole] = await Promise.all([
    prisma.role.findFirst({ where: { code: 'MANAGER_ADMIN', deletedAt: null } }),
    prisma.role.findFirst({ where: { code: 'TEAM_MEMBER', deletedAt: null } }),
  ]);
  if (!adminRole || !memberRole) {
    throw new Error('Roles are missing. Run npm run db:seed before adding demo data.');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  const now = new Date();
  const weekStart = mondayOf(now);
  const reportingStart = addDays(weekStart, -56);

  const users = [
    [ids.admin, adminRole.id, 'EMP-DEMO-ADMIN', 'Admin', 'Manager', 'admin@demo.local'],
    [ids.alice, memberRole.id, 'EMP-DEMO-001', 'Alice', 'Perera', 'alice@demo.local'],
    [ids.ben, memberRole.id, 'EMP-DEMO-002', 'Ben', 'Silva', 'ben@demo.local'],
    [ids.carla, memberRole.id, 'EMP-DEMO-003', 'Carla', 'Fernando', 'carla@demo.local'],
  ];

  for (const [id, roleId, employeeId, firstName, lastName, email] of users) {
    await prisma.user.upsert({
      where: { email },
      create: { id, roleId, employeeId, firstName, lastName, email, passwordHash, createdAt: now, updatedAt: now, activatedAt: now },
      update: { roleId, employeeId, firstName, lastName, passwordHash, activatedAt: now, deactivatedAt: null },
    });
  }

  for (const userId of [ids.alice, ids.ben, ids.carla]) {
    await prisma.userReportingPeriod.upsert({
      where: { userId_startWeek: { userId, startWeek: reportingStart } },
      create: { userId, startWeek: reportingStart },
      update: { endWeek: null },
    });
  }

  const projects = [
    [ids.atlas, 'Atlas website refresh', 'Atlas Co.', 'Modernize the customer website and launch reporting.'],
    [ids.portal, 'Client portal', 'Northstar Ltd.', 'Deliver the first client self-service portal release.'],
    [ids.operations, 'Operations improvements', 'Internal', 'Reduce recurring support and release-management work.'],
  ];
  for (const [id, name, clientName, description] of projects) {
    await prisma.project.upsert({
      where: { id },
      create: { id, name, clientName, description, startDate: addDays(weekStart, -28), endDate: addDays(weekStart, 56) },
      update: { name, clientName, description, archivedAt: null },
    });
  }

  for (const [projectId, userId] of [
    [ids.atlas, ids.alice], [ids.atlas, ids.ben], [ids.portal, ids.ben],
    [ids.portal, ids.carla], [ids.operations, ids.alice], [ids.operations, ids.carla],
  ]) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });
  }

  const tasks = [
    ['2d25fe6f-4f88-4bce-91ed-e0e270b35501', ids.alice, ids.atlas, 'Build dashboard charts', 'Implement the manager and personal dashboard visualizations.', 'DEVELOPMENT', 'COMPLETED', 'HIGH', 100, 720, 'Dashboard charts are ready for review.', 540],
    ['2d25fe6f-4f88-4bce-91ed-e0e270b35502', ids.alice, ids.operations, 'Prepare release notes', 'Document the weekly release and known issues.', 'DOCUMENTATION', 'IN_PROGRESS', 'MEDIUM', 65, 240, null, 135],
    ['2d25fe6f-4f88-4bce-91ed-e0e270b35503', ids.ben, ids.atlas, 'Test authentication flow', 'Run regression checks for login, logout, and refresh.', 'TESTING', 'COMPLETED', 'HIGH', 100, 480, 'Authentication regression checks passed.', 420],
    ['2d25fe6f-4f88-4bce-91ed-e0e270b35504', ids.ben, ids.portal, 'Implement activity feed', 'Add recent report and review events to the portal.', 'DEVELOPMENT', 'IN_PROGRESS', 'HIGH', 50, 600, null, 300],
    ['2d25fe6f-4f88-4bce-91ed-e0e270b35505', ids.carla, ids.portal, 'Client planning meeting', 'Agree the portal scope and delivery milestones.', 'MEETINGS', 'COMPLETED', 'MEDIUM', 100, 120, 'Scope and milestones agreed with the client.', 120],
    ['2d25fe6f-4f88-4bce-91ed-e0e270b35506', ids.carla, ids.operations, 'Resolve deployment blocker', 'Investigate the staging configuration failure.', 'OTHER', 'BLOCKED', 'URGENT', 35, 360, null, 180],
  ];
  for (const [id, assigneeId, projectId, name, description, taskType, status, priority, actualCompletionPct, plannedMinutes, deliverable, actualMinutes] of tasks) {
    const completedAt = status === 'COMPLETED' ? now : null;
    await prisma.task.upsert({
      where: { id },
      create: { id, createdBy: ids.admin, assigneeId, projectId, name, description, plannedDate: weekStart, dueDate: addDays(weekStart, 4), taskType, status, priority, actualCompletionPct, plannedMinutes, deliverable, completedAt },
      update: { assigneeId, projectId, name, description, taskType, status, priority, actualCompletionPct, plannedMinutes, deliverable, completedAt, archivedAt: null },
    });
    await prisma.taskTimeEntry.upsert({
      where: { id },
      create: { id, taskId: id, userId: assigneeId, workDate: addDays(weekStart, 1), minutes: actualMinutes, note: 'Demo time entry' },
      update: { minutes: actualMinutes, note: 'Demo time entry' },
    });
  }

  const reports = [
    ['3d25fe6f-4f88-4bce-91ed-e0e270b35501', '4d25fe6f-4f88-4bce-91ed-e0e270b35501', ids.alice, 'SUBMITTED', 'Completed dashboard work and prepared release documentation.'],
    ['3d25fe6f-4f88-4bce-91ed-e0e270b35502', '4d25fe6f-4f88-4bce-91ed-e0e270b35502', ids.ben, 'NEEDS_CORRECTION', 'Authentication testing is complete; the activity feed needs follow-up.'],
    ['3d25fe6f-4f88-4bce-91ed-e0e270b35503', '4d25fe6f-4f88-4bce-91ed-e0e270b35503', ids.carla, 'APPROVED', 'Client scope is agreed; deployment configuration is blocked.'],
  ];
  for (const [reportId, versionId, memberId, status, notes] of reports) {
    await prisma.report.upsert({
      where: { memberId_weekStart: { memberId, weekStart } },
      create: { id: reportId, memberId, weekStart, status },
      update: { status },
    });
    await prisma.reportVersion.upsert({
      where: { reportId_versionNumber: { reportId, versionNumber: 1 } },
      create: { id: versionId, reportId, versionNumber: 1, notes, createdAt: now, updatedAt: now, submittedAt: now },
      update: { notes, submittedAt: now },
    });
  }

  const reportTasks = [
    ['5d25fe6f-4f88-4bce-91ed-e0e270b35501', reports[0][1], tasks[0], 'THIS_WEEK', 'Atlas website refresh', 'Alice Perera'],
    ['5d25fe6f-4f88-4bce-91ed-e0e270b35502', reports[0][1], tasks[1], 'THIS_WEEK', 'Operations improvements', 'Alice Perera'],
    ['5d25fe6f-4f88-4bce-91ed-e0e270b35503', reports[1][1], tasks[2], 'THIS_WEEK', 'Atlas website refresh', 'Ben Silva'],
    ['5d25fe6f-4f88-4bce-91ed-e0e270b35504', reports[1][1], tasks[3], 'THIS_WEEK', 'Client portal', 'Ben Silva'],
    ['5d25fe6f-4f88-4bce-91ed-e0e270b35505', reports[2][1], tasks[4], 'THIS_WEEK', 'Client portal', 'Carla Fernando'],
    ['5d25fe6f-4f88-4bce-91ed-e0e270b35506', reports[2][1], tasks[5], 'THIS_WEEK', 'Operations improvements', 'Carla Fernando'],
  ];
  for (const [id, reportVersionId, task, section, projectNameSnapshot, assigneeName] of reportTasks) {
    const [sourceTaskId, , projectId, name, description, taskType, status, priority, actualCompletionPct, plannedMinutes, deliverable, actualMinutes] = task;
    await prisma.reportTask.upsert({
      where: { id },
      create: { id, reportVersionId, sourceTaskId, sourceTaskDescription: description, sourceTaskPlannedDate: weekStart, sourceTaskDueDate: addDays(weekStart, 4), sourceTaskAssigneeName: assigneeName, projectId, projectNameSnapshot, section, name, taskType, status, priority, actualCompletionPct, plannedMinutes, actualMinutes, deliverable, displayOrder: 0 },
      update: { sourceTaskDescription: description, sourceTaskAssigneeName: assigneeName, taskType, status, priority, actualCompletionPct, plannedMinutes, actualMinutes, deliverable },
    });
  }

  await prisma.reportBlocker.upsert({
    where: { id: '6d25fe6f-4f88-4bce-91ed-e0e270b35501' },
    create: { id: '6d25fe6f-4f88-4bce-91ed-e0e270b35501', reportVersionId: reports[2][1], description: 'Staging deployment configuration needs platform access.', isKey: true, status: 'OPEN', displayOrder: 0 },
    update: { status: 'OPEN' },
  });
  await prisma.reportAchievement.upsert({
    where: { id: '7d25fe6f-4f88-4bce-91ed-e0e270b35501' },
    create: { id: '7d25fe6f-4f88-4bce-91ed-e0e270b35501', reportVersionId: reports[0][1], description: 'Dashboard visual insights implemented.', isKey: true, displayOrder: 0 },
    update: {},
  });
  await prisma.reportReview.upsert({
    where: { reportVersionId: reports[2][1] },
    create: { reportVersionId: reports[2][1], reviewerId: ids.admin, decision: 'APPROVED', comment: 'Good progress and a clear next step.' },
    update: { decision: 'APPROVED', comment: 'Good progress and a clear next step.' },
  });
  await prisma.reportReview.upsert({
    where: { reportVersionId: reports[1][1] },
    create: { reportVersionId: reports[1][1], reviewerId: ids.admin, decision: 'CHANGES_REQUESTED', comment: 'Please add a delivery date for the activity feed.' },
    update: { decision: 'CHANGES_REQUESTED', comment: 'Please add a delivery date for the activity feed.' },
  });

  console.log(`Demo data seeded in ${target.hostname}/${schema} for week ${weekStart.toISOString().slice(0, 10)}.`);
  console.log('Accounts: admin@demo.local, alice@demo.local, ben@demo.local, carla@demo.local');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
