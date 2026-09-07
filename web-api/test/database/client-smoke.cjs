require('dotenv/config');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      process.env.NODE_ENV !== 'production',
    'Use a local development database.',
  );
  const prisma = new PrismaService(
    new ConfigService({ db: { databaseUrl: url.toString() } }),
  );
  const rollback = new Error('Expected verification rollback');
  let roleId;
  try {
    await prisma.$transaction(
      async (tx) => {
        // Exercising every delegate also verifies the runtime adapter's schema.
        for (const model of [
          'role',
          'permission',
          'rolePermission',
          'user',
          'userReportingPeriod',
          'authSession',
          'userInvitation',
          'project',
          'task',
          'taskTimeEntry',
          'report',
          'reportVersion',
          'reportTask',
          'reportBlocker',
          'reportAchievement',
          'reportReview',
          'notification',
        ]) {
          assert.equal(typeof (await tx[model].count()), 'number');
        }
        const past = new Date('2026-01-01T00:00:00Z');
        const role = await tx.role.create({
          data: {
            code: randomUUID(),
            name: 'Client verification',
            updatedAt: past,
          },
        });
        roleId = role.id;
        assert.match(
          role.id,
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        const updated = await tx.role.update({
          where: { id: role.id },
          data: { name: 'Updated verification' },
        });
        assert(updated.updatedAt > past, 'Prisma maintains updatedAt');
        const member = await tx.user.create({
          data: {
            roleId: role.id,
            employeeId: randomUUID().slice(0, 30),
            firstName: 'Test',
            lastName: 'Member',
            email: `${randomUUID()}@example.invalid`,
          },
        });
        const project = await tx.project.create({
          data: { name: 'Client verification' },
        });
        const task = await tx.task.create({
          data: {
            createdBy: member.id,
            assigneeId: member.id,
            projectId: project.id,
            name: 'Client task',
            plannedDate: new Date('2026-09-07T00:00:00Z'),
            plannedCompletionPct: '12.34',
          },
        });
        assert.equal(
          task.plannedDate.toISOString(),
          '2026-09-07T00:00:00.000Z',
        );
        assert.equal(task.plannedCompletionPct.toString(), '12.34');
        const report = await tx.report.create({
          data: {
            memberId: member.id,
            weekStart: new Date('2026-09-07T00:00:00Z'),
          },
        });
        const version = await tx.reportVersion.create({
          data: {
            reportId: report.id,
            versionNumber: 1,
            createdAt: past,
            submittedAt: new Date(),
          },
        });
        const draft = await tx.reportVersion.create({
          data: { reportId: report.id, versionNumber: 2 },
        });
        const editable = await tx.reportVersion.findFirst({
          where: { reportId: report.id, submittedAt: null },
        });
        assert.equal(
          editable.id,
          draft.id,
          'partial uniqueness needs the explicit predicate in client queries',
        );
        const review = await tx.reportReview.create({
          data: {
            reportVersionId: version.id,
            reviewerId: member.id,
            decision: 'APPROVED',
          },
        });
        const notification = await tx.notification.create({
          data: {
            recipient: { connect: { id: member.id } },
            actor: { connect: { id: member.id } },
            eventKey: randomUUID(),
            type: 'REPORT_APPROVED',
            title: 'Review',
            message: 'Verification',
            reviewVersion: {
              connect: {
                id_reportVersionId: {
                  id: review.id,
                  reportVersionId: version.id,
                },
              },
            },
          },
          include: {
            reportVersion: true,
            reportReview: true,
            reviewVersion: true,
          },
        });
        assert.equal(notification.reportVersion.id, version.id);
        assert.equal(notification.reportReview.id, review.id);
        assert.equal(notification.reviewVersion.id, review.id);
        // These fixtures intentionally do not implement ownership/review services.
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  try {
    assert(roleId, 'transaction reached client-generated UUID check');
    assert.equal(
      await prisma.role.findUnique({ where: { id: roleId } }),
      null,
      'fixtures rolled back',
    );
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    'PrismaService client passed: all 17 mappings, UUIDs, updatedAt, date/decimal types and composite notification relation. All writes rolled back.',
  );
}
main().catch((error) => {
  console.error(
    error.code === 'ERR_ASSERTION'
      ? error.message
      : `Client verification failed (${error.code ?? error.name}).`,
  );
  process.exitCode = 1;
});
