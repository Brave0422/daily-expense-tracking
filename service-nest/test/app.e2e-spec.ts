/**
 * @author 未知（历史未记录）
 * @date 未知（历史未记录）
 * @description HTTP 前缀与认证边界回归，使用服务替身验证路由、验证码和 Cookie。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AuthController } from '../src/modules/auth/auth.controller';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { AuthTokenService } from '../src/modules/auth/services/auth-token.service';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { UsersService } from '../src/modules/users/users.service';
import { VerificationCodesController } from '../src/modules/verification-codes/verification-codes.controller';
import { VerificationCodesService } from '../src/modules/verification-codes/verification-codes.service';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

jest.mock('../src/modules/auth/services/auth.service', () => ({
  AuthService: class {},
}));
jest.mock('../src/modules/auth/services/auth-token.service', () => ({
  AuthTokenService: class {},
}));
jest.mock('../src/modules/auth/services/password.service', () => ({
  PasswordService: class {},
}));
jest.mock('../src/modules/users/users.service', () => ({
  UsersService: class {},
}));
jest.mock(
  '../src/modules/verification-codes/verification-codes.service',
  () => ({
    VerificationCodesService: class {},
  }),
);

describe('API prefix and authentication (e2e)', () => {
  let app: INestApplication<App>;
  const authService = {
    login: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    refresh: jest.fn().mockResolvedValue({
      accessToken: 'renewed-access-token',
      refreshToken: 'renewed-refresh-token',
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const sendCode = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, AuthController, VerificationCodesController],
      providers: [
        AppService,
        { provide: AuthService, useValue: authService },
        { provide: PasswordService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('development') },
        },
        {
          provide: AuthTokenService,
          useValue: {
            verifyAccessToken: jest.fn().mockResolvedValue({
              sub: '7',
              sid: 'session-id',
              tokenType: 'access',
            }),
            findSessionBySid: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: UsersService,
          useValue: { existsById: jest.fn().mockResolvedValue(true) },
        },
        { provide: VerificationCodesService, useValue: { sendCode } },
        JwtAuthGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalGuards(app.get(JwtAuthGuard));
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  it('GET /api reaches the prefixed root route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: 'Hello World!',
    });
  });

  it('unprefixed routes are unavailable', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
    await request(app.getHttpServer()).post('/auth/login').expect(404);
    await request(app.getHttpServer())
      .post('/verification-codes/send')
      .expect(404);
  });

  it('login, refresh and logout share /api/auth Cookie scope', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: '123456' })
      .expect(200);
    expect(login.headers['set-cookie']).toEqual([
      expect.stringContaining('Path=/api/auth;'),
    ]);

    await agent.post('/api/auth/refresh').expect(200);
    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');

    const logout = await agent
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    expect(logout.headers['set-cookie']).toEqual([
      expect.stringContaining('Path=/api/auth;'),
    ]);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it.each(['register', 'reset_password'])(
    '%s verification codes remain public under /api',
    async (purpose) => {
      await request(app.getHttpServer())
        .post('/api/verification-codes/send')
        .send({ purpose, email: 'test@example.com' })
        .expect(200);
      expect(sendCode).toHaveBeenCalledWith(
        'test@example.com',
        purpose,
        undefined,
      );
    },
  );

  it('change-password verification codes still require authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/verification-codes/send')
      .send({ purpose: 'change_password' })
      .expect(401);
    expect(sendCode).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await app.close();
  });
});
