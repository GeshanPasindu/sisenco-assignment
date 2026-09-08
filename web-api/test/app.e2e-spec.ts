import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/configure-app';
import { randomBytes } from 'node:crypto';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = randomBytes(48).toString('base64');
    process.env.JWT_ISSUER = 'e2e-api';
    process.env.JWT_AUDIENCE = 'e2e-client';
    process.env.CORS_ORIGINS = 'https://frontend.example.com';
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAME_SITE = 'lax';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  it('/api/v1 (GET) uses the shared envelope', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          data: 'Hello World!',
          meta: { requestId: response.headers['x-request-id'] },
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
