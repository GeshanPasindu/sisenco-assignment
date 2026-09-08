// Real HTTP + PostgreSQL checks, using only UUID-isolated fixtures that are
// removed by scoped DELETEs. No schema resets, production seeds or test routes.
require('dotenv/config');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ThrottlerStorage } = require('@nestjs/throttler');
const request = require('supertest');
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');

const url = new URL(
  process.env.AUTH_TEST_DATABASE_URL ?? process.env.DATABASE_URL,
);
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    process.env.NODE_ENV !== 'production',
  'Auth tests require a local development/test target.',
);
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = randomBytes(48).toString('base64');
process.env.JWT_ISSUER = 'auth-test-api';
process.env.JWT_AUDIENCE = 'auth-test-browser';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.ACCESS_TOKEN_SECONDS = '900';
process.env.REFRESH_SESSION_SECONDS = '604800';
process.env.PASSWORD_MIN_LENGTH = '15';
process.env.PASSWORD_MAX_LENGTH = '128';

const { AppModule } = require('../../dist/src/app.module.js');
const { configureApp } = require('../../dist/src/configure-app.js');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');
const {
  AuthService,
  tokenHash,
  activationWeek,
} = require('../../dist/src/auth/auth.service.js');
const { JwtAuthGuard } = require('../../dist/src/auth/jwt-auth.guard.js');
const {
  Roles,
  Permissions,
  RolesGuard,
  PermissionsGuard,
} = require('../../dist/src/auth/authorization.js');
const { loadAuthConfig } = require('../../dist/src/config/auth.config.js');
const {
  RefreshCookieService,
} = require('../../dist/src/auth/refresh-cookie.service.js');
const { ConfigService } = require('@nestjs/config');

const origin = 'http://localhost:5173';
const password = '  safe test passphrase 😀  ';
const replacement = 'new passphrase for auth tests';
let app, prisma, auth, api, storage, hash;
const users = [],
  roles = [],
  permissions = [];

before(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
  auth = app.get(AuthService);
  storage = app.get(ThrottlerStorage);
  api = request(app.getHttpServer());
  hash = await auth.hashPassword(password);
});
beforeEach(() => {
  storage.onApplicationShutdown();
  storage.storage.clear();
});
afterEach(async () => {
  if (!prisma) return;
  // Never delete by an email pattern or across the application database.
  await prisma.$transaction(async (tx) => {
    await tx.authSession.deleteMany({ where: { userId: { in: users } } });
    await tx.userInvitation.deleteMany({ where: { userId: { in: users } } });
    await tx.userReportingPeriod.deleteMany({
      where: { userId: { in: users } },
    });
    await tx.user.deleteMany({ where: { id: { in: users } } });
    await tx.rolePermission.deleteMany({ where: { roleId: { in: roles } } });
    await tx.role.deleteMany({ where: { id: { in: roles } } });
    await tx.permission.deleteMany({ where: { id: { in: permissions } } });
  });
  users.length = roles.length = permissions.length = 0;
});
after(async () => {
  if (app) await app.close();
});

async function member(options = {}) {
  const roleId = randomUUID();
  roles.push(roleId);
  const role = await prisma.role.create({
    data: { id: roleId, code: randomUUID(), name: 'Auth fixture role' },
  });
  const id = randomUUID();
  users.push(id);
  const user = await prisma.user.create({
    data: {
      id,
      roleId: role.id,
      employeeId: randomUUID().slice(0, 30),
      firstName: 'Auth',
      lastName: 'Fixture',
      email: `${id}@example.invalid`,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      activatedAt: new Date('2026-01-01T00:00:00Z'),
      passwordHash: hash,
      ...options,
    },
  });
  return user;
}
async function grant(user, code) {
  const id = randomUUID();
  permissions.push(id);
  const permission = await prisma.permission.create({ data: { id, code } });
  await prisma.rolePermission.create({
    data: { roleId: user.roleId, permissionId: id },
  });
  return permission;
}
const post = (route) => api.post(`/api/v1/auth/${route}`).set('Origin', origin);
async function login(user, value = password) {
  return post('login').send({ email: user.email, password: value });
}
const cookie = (response) => response.headers['set-cookie'][0].split(';')[0];
const token = (response) => response.body.data.accessToken;
function envelope(response) {
  assert.equal(response.body.meta.requestId, response.headers['x-request-id']);
  assert.deepEqual(
    Object.keys(response.body).sort(),
    [response.status >= 400 ? 'error' : 'data', 'meta'].sort(),
  );
}
function error(response, status, code) {
  assert.equal(
    response.status,
    status,
    `expected ${status}, got ${response.status}`,
  );
  envelope(response);
  assert.deepEqual(
    Object.keys(response.body.error).sort(),
    ['statusCode', 'code', 'message', 'details', 'context'].sort(),
  );
  assert.equal(response.body.error.code, code);
  assert.equal(response.body.error.statusCode, status);
  assert.equal(response.body.error.context, null);
  assert(Array.isArray(response.body.error.details));
}
function empty(response) {
  assert.equal(response.status, 204);
  assert.equal(response.text, '');
  assert(response.headers['x-request-id']);
  const header = response.headers['set-cookie'][0];
  assert.match(header, /Max-Age=0/);
  assert.match(header, /Path=\/api\/v1\/auth/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
}
async function invitation(options = {}) {
  const user = await member({ activatedAt: null, passwordHash: null });
  const raw = randomBytes(32).toString('base64url');
  const record = await prisma.userInvitation.create({
    data: {
      userId: user.id,
      invitedBy: user.id,
      tokenHash: tokenHash(raw),
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() + 86400000),
      ...options,
    },
  });
  return { user, raw, record };
}
const acceptBody = (raw) => ({
  token: raw,
  password,
  firstName: 'Updated',
  lastName: 'Person',
  personalEmail: null,
  contactNumber: '+94770000000',
  addressLine1: null,
  addressLine2: null,
  city: 'Colombo',
  postalCode: '00100',
});

test('A01 exact success envelope, normalized email, full permissions, opaque cookie and independent sessions', async () => {
  const user = await member();
  const codes = ['a', 'b', 'c', 'd'].map((c) => `${randomUUID()}:${c}`);
  for (const code of codes) await grant(user, code);
  const result = await post('login')
    .set('X-Request-Id', 'auth-contract-test')
    .send({ email: ` ${user.email.toUpperCase()} `, password });
  assert.equal(result.status, 200);
  envelope(result);
  assert.equal(result.headers['x-request-id'], 'auth-contract-test');
  assert.deepEqual(
    Object.keys(result.body.data).sort(),
    ['accessToken', 'expiresIn', 'tokenType', 'user'].sort(),
  );
  assert.equal(result.body.data.expiresIn, 900);
  assert.equal(result.body.data.tokenType, 'Bearer');
  const dto = result.body.data.user;
  assert.deepEqual(
    Object.keys(dto).sort(),
    [
      'id',
      'employeeId',
      'email',
      'firstName',
      'lastName',
      'role',
      'permissions',
      'accountStatus',
    ].sort(),
  );
  assert.deepEqual(Object.keys(dto.role).sort(), ['code', 'id', 'name']);
  assert.deepEqual(dto.permissions, codes.sort());
  assert.equal(dto.accountStatus, 'ACTIVE');
  assert.equal(dto.email, user.email);
  const header = result.headers['set-cookie'][0];
  assert.match(header, /refreshToken=[A-Za-z0-9_-]{43};/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\/api\/v1\/auth/);
  assert(!header.includes('Domain='));
  assert(!header.includes('Secure'));
  assert(Number(header.match(/Max-Age=(\d+)/)[1]) <= 604800);
  const stored = await prisma.authSession.findFirst({
    where: { userId: user.id },
  });
  assert.equal(
    stored.refreshTokenHash,
    tokenHash(cookie(result).split('=')[1]),
  );
  assert(!JSON.stringify(result.body).includes(stored.refreshTokenHash));
  assert(!JSON.stringify(result.body).includes(cookie(result).split('=')[1]));
  assert.equal((await login(user)).status, 200);
  assert.equal(
    await prisma.authSession.count({ where: { userId: user.id } }),
    2,
  );
});

test('A01 generic failures for wrong/unknown/invited/deactivated/retired users and preserves password spaces', async () => {
  const active = await member();
  const invited = await member({ passwordHash: null, activatedAt: null });
  const deactivated = await member({ deactivatedAt: new Date() });
  const retired = await member();
  await prisma.role.update({
    where: { id: retired.roleId },
    data: { deletedAt: new Date() },
  });
  const failures = [
    await login(active, 'wrong'),
    await login({ email: `${randomUUID()}@example.invalid` }),
    await login(invited),
    await login(deactivated),
    await login(retired),
    await login(active, password.trim()),
  ];
  for (const response of failures) {
    error(response, 401, 'INVALID_CREDENTIALS');
    assert.deepEqual(response.body.error, failures[0].body.error);
  }
  const legacy = await member({ passwordHash: await auth.hashPassword('old') });
  assert.equal((await login(legacy, 'old')).status, 200);
});

test('DTO allowlists, password bounds, null handling, bodyless actions, query rejection and safe errors', async () => {
  const user = await member();
  const session = await login(user);
  for (const body of [
    { email: user.email, password, role: 'MANAGER_ADMIN' },
    { email: null, password },
    { email: user.email, password: null },
  ])
    error(await post('login').send(body), 400, 'VALIDATION_FAILED');
  error(
    await post('login?extra=true').send({ email: user.email, password }),
    400,
    'VALIDATION_FAILED',
  );
  error(
    await post('refresh').set('Cookie', cookie(session)).send({}),
    400,
    'VALIDATION_FAILED',
  );
  error(
    await post('logout').send({ anything: true }),
    400,
    'VALIDATION_FAILED',
  );
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(session)}`)
      .send({ currentPassword: password, newPassword: 'short' }),
    400,
    'VALIDATION_FAILED',
  );
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(session)}`)
      .send({ currentPassword: password, newPassword: 'x'.repeat(129) }),
    400,
    'VALIDATION_FAILED',
  );
  const malformed = await post('login')
    .set('Content-Type', 'application/json')
    .send('{');
  error(malformed, 400, 'VALIDATION_FAILED');
  assert(!JSON.stringify(malformed.body).includes('SyntaxError'));
});

test('CSRF requires exact allowed Origin independently of CORS; configured secure cross-site cookie attributes', async () => {
  error(await api.post('/api/v1/auth/logout'), 403, 'FORBIDDEN');
  error(
    await api.post('/api/v1/auth/logout').set('Origin', 'null'),
    403,
    'FORBIDDEN',
  );
  error(
    await api.post('/api/v1/auth/logout').set('Origin', 'https://evil.example'),
    403,
    'FORBIDDEN',
  );
  error(
    await api
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:5173.evil.example'),
    403,
    'FORBIDDEN',
  );
  const headers = {};
  const service = new RefreshCookieService(
    new ConfigService({ auth: { secure: true, sameSite: 'none' } }),
  );
  const response = {
    cookie: (name, value, options) => {
      headers[name] = { value, options };
    },
  };
  service.set(response, 'opaque', new Date(Date.now() + 10000));
  assert.deepEqual(
    { ...headers.refreshToken.options, expires: undefined, maxAge: undefined },
    {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/v1/auth',
      expires: undefined,
      maxAge: undefined,
    },
  );
  service.clear(response);
  assert.equal(headers.refreshToken.options.secure, true);
  assert.equal(headers.refreshToken.options.sameSite, 'none');
  assert.equal(headers.refreshToken.options.maxAge, 0);
});

test('A02 refresh rotates once under concurrency, rejects superseded tokens and preserves absolute expiry', async () => {
  const user = await member();
  const initial = await login(user);
  const first = await prisma.authSession.findFirst({
    where: { userId: user.id },
  });
  const responses = await Promise.all([
    post('refresh').set('Cookie', cookie(initial)),
    post('refresh').set('Cookie', cookie(initial)),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
  const success = responses.find((r) => r.status === 200);
  envelope(success);
  assert.notEqual(cookie(success), cookie(initial));
  const current = await prisma.authSession.findUnique({
    where: { id: first.id },
  });
  assert.equal(current.expiresAt.toISOString(), first.expiresAt.toISOString());
  assert(current.lastUsedAt);
  assert.equal(
    current.refreshTokenHash,
    tokenHash(cookie(success).split('=')[1]),
  );
  error(
    await post('refresh').set('Cookie', cookie(initial)),
    401,
    'INVALID_REFRESH_SESSION',
  );
  assert.equal(
    (await post('refresh').set('Cookie', cookie(success))).status,
    200,
  );
});

test('A02 rejects absent/invalid/expired/revoked credentials and current inactive state', async () => {
  error(await post('refresh'), 401, 'INVALID_REFRESH_SESSION');
  error(
    await post('refresh').set('Cookie', 'refreshToken=invalid'),
    401,
    'INVALID_REFRESH_SESSION',
  );
  const user = await member();
  const session = await login(user);
  await prisma.authSession.updateMany({
    where: { userId: user.id },
    data: {
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  error(
    await post('refresh').set('Cookie', cookie(session)),
    401,
    'INVALID_REFRESH_SESSION',
  );
  const next = await login(user);
  await prisma.authSession.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date() },
  });
  error(
    await post('refresh').set('Cookie', cookie(next)),
    401,
    'INVALID_REFRESH_SESSION',
  );
  const retired = await login(user);
  await prisma.role.update({
    where: { id: user.roleId },
    data: { deletedAt: new Date() },
  });
  error(
    await post('refresh').set('Cookie', cookie(retired)),
    401,
    'INVALID_REFRESH_SESSION',
  );
});

test('JWT validates signature, algorithm, issuer, audience, expiry, subject/session linkage and revocation', async () => {
  const user = await member();
  const other = await member();
  const session = await login(user);
  const jwt = new JwtService({
    secret: Buffer.from(process.env.JWT_SECRET, 'base64'),
    signOptions: {
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
      expiresIn: 900,
    },
  });
  const stored = await prisma.authSession.findFirst({
    where: { userId: user.id },
  });
  const payload = { sub: user.id, sid: stored.id };
  const variants = [
    'bad',
    jwt.sign(payload, { expiresIn: -1 }),
    jwt.sign(payload, { issuer: 'wrong' }),
    jwt.sign(payload, { audience: 'wrong' }),
    jwt.sign(payload, { algorithm: 'HS384' }),
    jwt.sign({ ...payload, sub: other.id }),
    jwt.sign({ ...payload, sid: randomUUID() }),
    jwt.sign(payload, { secret: randomBytes(48) }),
  ];
  for (const value of variants)
    error(
      await post('change-password')
        .set('Authorization', `Bearer ${value}`)
        .send({ currentPassword: 'wrong', newPassword: replacement }),
      401,
      'UNAUTHENTICATED',
    );
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(session)}`)
      .send({ currentPassword: 'wrong', newPassword: replacement }),
    400,
    'CURRENT_PASSWORD_INCORRECT',
  );
  await prisma.authSession.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(session)}`)
      .send({ currentPassword: password, newPassword: replacement }),
    401,
    'UNAUTHENTICATED',
  );
});

test('Database role and permission changes affect the next authentication; all/any and role guards fail closed', async () => {
  const user = await member();
  const permission = await grant(user, `${randomUUID()}:own`);
  const initial = await login(user);
  const session = await prisma.authSession.findFirst({
    where: { userId: user.id },
  });
  let context = await auth.authenticate(user.id, session.id);
  assert.deepEqual(context.permissions, [permission.code]);
  await prisma.rolePermission.delete({
    where: {
      roleId_permissionId: { roleId: user.roleId, permissionId: permission.id },
    },
  });
  context = await auth.authenticate(user.id, session.id);
  assert.deepEqual(context.permissions, []);
  const refreshed = await post('refresh').set('Cookie', cookie(initial));
  assert.deepEqual(refreshed.body.data.user.permissions, []);
  class Controller {}
  const handler = () => {};
  const reflector = new Reflector();
  const fake = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ user: context }) }),
  };
  const rg = new RolesGuard(reflector),
    pg = new PermissionsGuard(reflector);
  Roles('MANAGER_ADMIN')(handler);
  assert.throws(() => rg.canActivate(fake));
  context = {
    ...context,
    role: { ...context.role, code: 'MANAGER_ADMIN' },
    permissions: ['one'],
  };
  assert.equal(rg.canActivate(fake), true);
  Permissions.all('one', 'two')(handler);
  assert.throws(() => pg.canActivate(fake));
  Permissions.any('one', 'two')(handler);
  assert.equal(pg.canActivate(fake), true);
  context.permissions = [];
  assert.throws(() => pg.canActivate(fake));
  context = undefined;
  assert.throws(() => rg.canActivate(fake));
  assert.throws(() => pg.canActivate(fake));
  await prisma.role.update({
    where: { id: user.roleId },
    data: { deletedAt: new Date() },
  });
  await assert.rejects(auth.authenticate(user.id, session.id));
});

test('A03 logout is bodyless with valid, missing, invalid and expired cookies, even with expired JWT', async () => {
  const user = await member();
  const session = await login(user);
  empty(
    await post('logout')
      .set('Cookie', cookie(session))
      .set('Authorization', 'Bearer expired'),
  );
  error(
    await post('refresh').set('Cookie', cookie(session)),
    401,
    'INVALID_REFRESH_SESSION',
  );
  empty(await post('logout'));
  empty(await post('logout').set('Cookie', 'refreshToken=invalid'));
  const expired = await login(user);
  await prisma.authSession.updateMany({
    where: { userId: user.id },
    data: {
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  empty(await post('logout').set('Cookie', cookie(expired)));
});

test('A04 password change revokes every session and existing access JWTs; incorrect current password preserves sessions', async () => {
  const user = await member();
  const one = await login(user),
    two = await login(user);
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(one)}`)
      .send({ currentPassword: 'wrong', newPassword: replacement }),
    400,
    'CURRENT_PASSWORD_INCORRECT',
  );
  assert.equal(
    await prisma.authSession.count({
      where: { userId: user.id, revokedAt: null },
    }),
    2,
  );
  empty(
    await post('change-password')
      .set('Authorization', `Bearer ${token(one)}`)
      .send({ currentPassword: password, newPassword: replacement }),
  );
  assert.equal(
    await prisma.authSession.count({
      where: { userId: user.id, revokedAt: null },
    }),
    0,
  );
  error(
    await post('refresh').set('Cookie', cookie(two)),
    401,
    'INVALID_REFRESH_SESSION',
  );
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(two)}`)
      .send({ currentPassword: replacement, newPassword: password }),
    401,
    'UNAUTHENTICATED',
  );
  error(await login(user), 401, 'INVALID_CREDENTIALS');
  assert.equal((await login(user, replacement)).status, 200);
});

test('Password change serializes with concurrent stale login and refresh; no old session survives', async () => {
  const user = await member();
  const initial = await login(user);
  const responses = await Promise.all([
    post('change-password')
      .set('Authorization', `Bearer ${token(initial)}`)
      .send({ currentPassword: password, newPassword: replacement }),
    login(user),
    post('refresh').set('Cookie', cookie(initial)),
  ]);
  assert.equal(responses[0].status, 204);
  assert([200, 401].includes(responses[1].status));
  assert([200, 401].includes(responses[2].status));
  assert.equal(
    await prisma.authSession.count({
      where: { userId: user.id, revokedAt: null },
    }),
    0,
  );
});

test('A05 exact minimal prefill without consumption; A06 activation preserves assigned identity and adjusts reporting eligibility', async () => {
  const fixture = await invitation();
  const week = activationWeek(new Date());
  const past = new Date(week);
  past.setUTCDate(past.getUTCDate() - 14);
  await prisma.userReportingPeriod.create({
    data: { userId: fixture.user.id, startWeek: past },
  });
  const prefill = await post('invitations/check').send({ token: fixture.raw });
  assert.equal(prefill.status, 200);
  envelope(prefill);
  assert.deepEqual(prefill.body.data, {
    email: fixture.user.email,
    firstName: fixture.user.firstName,
    lastName: fixture.user.lastName,
    expiresAt: fixture.record.expiresAt.toISOString(),
  });
  assert.equal(
    (
      await prisma.userInvitation.findUnique({
        where: { id: fixture.record.id },
      })
    ).consumedAt,
    null,
  );
  const result = await post('accept-invitation').send(acceptBody(fixture.raw));
  assert.equal(result.status, 200);
  envelope(result);
  assert.deepEqual(result.body.data, { activated: true });
  assert.equal(result.headers['set-cookie'], undefined);
  const user = await prisma.user.findUnique({ where: { id: fixture.user.id } });
  assert.equal(user.roleId, fixture.user.roleId);
  assert.equal(user.email, fixture.user.email);
  assert.equal(user.firstName, 'Updated');
  assert.equal(user.personalEmail, null);
  assert.equal(user.postalCode, '00100');
  assert(user.activatedAt);
  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.equal(
    await prisma.authSession.count({ where: { userId: user.id } }),
    0,
  );
  assert.equal(
    (
      await prisma.userReportingPeriod.findFirst({ where: { userId: user.id } })
    ).startWeek.toISOString(),
    week.toISOString(),
  );
  assert.equal((await login(user)).status, 200);
  error(
    await post('accept-invitation').send(acceptBody(fixture.raw)),
    400,
    'INVALID_INVITATION',
  );
  error(
    await post('invitations/check').send({ token: fixture.raw }),
    400,
    'INVALID_INVITATION',
  );
});

test('Invitation acceptance rejects injected identity, role, permissions and schedule fields', async () => {
  const fixture = await invitation();
  for (const [field, value] of Object.entries({
    email: 'other@example.invalid',
    roleId: randomUUID(),
    permissions: ['admin'],
    startWeek: '2026-01-05',
    activatedAt: new Date().toISOString(),
    confirmPassword: password,
  })) {
    error(
      await post('accept-invitation').send({
        ...acceptBody(fixture.raw),
        [field]: value,
      }),
      400,
      'VALIDATION_FAILED',
    );
  }
  error(
    await post('accept-invitation').send({
      ...acceptBody(fixture.raw),
      firstName: ' \t',
    }),
    400,
    'VALIDATION_FAILED',
  );
  error(
    await post('accept-invitation').send({
      ...acceptBody(fixture.raw),
      password: 'short',
    }),
    400,
    'VALIDATION_FAILED',
  );
  assert.equal(
    (await prisma.user.findUnique({ where: { id: fixture.user.id } }))
      .activatedAt,
    null,
  );
});

test('Invitation expiry/revocation/inactive account are generic; concurrent acceptance has one winner', async () => {
  for (const options of [
    { expiresAt: new Date(Date.now() - 1000) },
    { revokedAt: new Date() },
  ]) {
    const fixture = await invitation(options);
    error(
      await post('invitations/check').send({ token: fixture.raw }),
      400,
      'INVALID_INVITATION',
    );
    error(
      await post('accept-invitation').send(acceptBody(fixture.raw)),
      400,
      'INVALID_INVITATION',
    );
  }
  const disabled = await invitation();
  await prisma.user.update({
    where: { id: disabled.user.id },
    data: { deactivatedAt: new Date() },
  });
  error(
    await post('invitations/check').send({ token: disabled.raw }),
    400,
    'INVALID_INVITATION',
  );
  const fixture = await invitation();
  const responses = await Promise.all([
    post('accept-invitation').send(acceptBody(fixture.raw)),
    post('accept-invitation').send(acceptBody(fixture.raw)),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  error(
    responses.find((r) => r.status === 400),
    400,
    'INVALID_INVITATION',
  );
});

test('Swagger exposes six auth routes and response/security schemas; throttling includes Retry-After', async () => {
  const docs = await api.get('/api-json');
  assert.equal(docs.status, 200);
  for (const route of [
    'login',
    'refresh',
    'logout',
    'change-password',
    'invitations/check',
    'accept-invitation',
  ])
    assert(docs.body.paths[`/api/v1/auth/${route}`].post);
  assert(docs.body.components.schemas.LoginDto.properties.password.writeOnly);
  assert(
    docs.body.paths['/api/v1/auth/login'].post.responses['200'].content[
      'application/json'
    ].schema.properties.meta,
  );
  assert(
    docs.body.paths['/api/v1/auth/refresh'].post.security.some(
      (s) => 'refreshToken' in s,
    ),
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await post('invitations/check').send({ token: 'invalid' })).status,
      400,
    );
  const limited = await post('invitations/check').send({ token: 'invalid' });
  error(limited, 429, 'RATE_LIMITED');
  assert(Number(limited.headers['retry-after']) > 0);
});

test('Secure startup configuration rejects missing/weak secrets, invalid lifetimes and unsafe cookie origins', () => {
  const base = { ...process.env };
  for (const change of [
    { JWT_SECRET: undefined },
    { JWT_SECRET: 'weak' },
    { JWT_ISSUER: '' },
    { JWT_AUDIENCE: '' },
    { ACCESS_TOKEN_SECONDS: '0' },
    { COOKIE_SECURE: 'false', NODE_ENV: 'production' },
    { COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' },
    { CORS_ORIGINS: 'http://evil.example' },
    { CORS_ORIGINS: '*' },
  ])
    assert.throws(() => loadAuthConfig({ ...base, ...change }));
  assert.equal(loadAuthConfig(base).accessSeconds, 900);
  assert.equal(
    activationWeek(new Date('2026-09-06T18:30:00Z')).toISOString(),
    '2026-09-07T00:00:00.000Z',
  );
  assert.equal(
    activationWeek(new Date('2026-09-06T18:29:59Z')).toISOString(),
    '2026-08-31T00:00:00.000Z',
  );
  const guard = new JwtAuthGuard();
  assert.throws(() => guard.handleRequest(new Error('infrastructure'), null));
});

test('Database failures surface as safe 503 errors, including optional logout verification', async () => {
  const original = prisma.authSession.findUnique;
  prisma.authSession.findUnique = async () => {
    throw Object.assign(
      new Error('private connection details must not escape'),
      { code: 'P1001' },
    );
  };
  try {
    const result = await post('logout').set(
      'Cookie',
      `refreshToken=${randomBytes(32).toString('base64url')}`,
    );
    error(result, 503, 'SERVICE_UNAVAILABLE');
    assert.match(result.headers['set-cookie'][0], /Max-Age=0/);
    assert(!JSON.stringify(result.body).includes('private connection'));
  } finally {
    prisma.authSession.findUnique = original;
  }
});

test('JWT rejects expired sessions and newly deactivated/unregistered users; role reassignment is current', async () => {
  const user = await member();
  const other = await member();
  const logged = await login(user);
  const session = await prisma.authSession.findFirst({
    where: { userId: user.id },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { roleId: other.roleId },
  });
  assert.equal(
    (await auth.authenticate(user.id, session.id)).role.id,
    other.roleId,
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { deactivatedAt: new Date() },
  });
  error(
    await post('change-password')
      .set('Authorization', `Bearer ${token(logged)}`)
      .send({ currentPassword: password, newPassword: replacement }),
    401,
    'UNAUTHENTICATED',
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { deactivatedAt: null, activatedAt: null, passwordHash: null },
  });
  await assert.rejects(auth.authenticate(user.id, session.id));
  await prisma.user.update({
    where: { id: user.id },
    data: { activatedAt: new Date(), passwordHash: hash },
  });
  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await assert.rejects(auth.authenticate(user.id, session.id));
});

test('A stale password verification cannot create a surviving login after a completed password change', async () => {
  const user = await member();
  const initial = await login(user);
  const original = auth.verifyPassword.bind(auth);
  let release, entered;
  const gated = new Promise((resolve) => {
    release = resolve;
  });
  const reached = new Promise((resolve) => {
    entered = resolve;
  });
  let first = true;
  auth.verifyPassword = async (...args) => {
    const result = await original(...args);
    if (first) {
      first = false;
      entered();
      await gated;
    }
    return result;
  };
  let pending;
  try {
    pending = login(user).then((response) => response);
    await reached;
    empty(
      await post('change-password')
        .set('Authorization', `Bearer ${token(initial)}`)
        .send({ currentPassword: password, newPassword: replacement }),
    );
    release();
    error(await pending, 401, 'INVALID_CREDENTIALS');
    assert.equal(
      await prisma.authSession.count({
        where: { userId: user.id, revokedAt: null },
      }),
      0,
    );
  } finally {
    release();
    if (pending) await pending;
    auth.verifyPassword = original;
  }
});

test('Activation preserves manager-selected future intervals and removes only elapsed never-active plans', async () => {
  const fixture = await invitation();
  const week = activationWeek(new Date());
  const past = new Date(week);
  past.setUTCDate(past.getUTCDate() - 14);
  const future = new Date(week);
  future.setUTCDate(future.getUTCDate() + 14);
  await prisma.userReportingPeriod.create({
    data: { userId: fixture.user.id, startWeek: past, endWeek: past },
  });
  await prisma.userReportingPeriod.create({
    data: { userId: fixture.user.id, startWeek: future },
  });
  assert.equal(
    (await post('accept-invitation').send(acceptBody(fixture.raw))).status,
    200,
  );
  const periods = await prisma.userReportingPeriod.findMany({
    where: { userId: fixture.user.id },
  });
  assert.equal(periods.length, 1);
  assert.equal(periods[0].startWeek.toISOString(), future.toISOString());
});
