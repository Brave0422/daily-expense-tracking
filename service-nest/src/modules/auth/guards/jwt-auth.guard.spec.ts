/**
 * @author Brave
 * @date 2026-09-27T11:26:12+08:00
 * @description JWT 鉴权守卫单元测试，验证会话和用户有效性的统一校验。
 */

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthTokenService } from '../services/auth-token.service';
import type { UserService } from '../../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('JwtAuthGuard', () => {
  const payload = {
    sub: '7',
    sid: 'session-id',
    tokenType: 'access' as const,
  };
  let request: {
    path: string;
    body: Record<string, unknown>;
    headers: { authorization: string };
    user?: { userId: number; sessionId: string };
  };
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let authTokenService: jest.Mocked<
    Pick<AuthTokenService, 'verifyAccessToken' | 'findSessionBySid'>
  >;
  let userService: jest.Mocked<Pick<UserService, 'existsById'>>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    request = {
      path: '/categories/getUserCategories',
      body: {},
      headers: { authorization: 'Bearer access-token' },
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    authTokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue(payload),
      findSessionBySid: jest.fn().mockResolvedValue({ id: 1 }),
    };
    userService = {
      existsById: jest.fn().mockResolvedValue(true),
    };
    guard = new JwtAuthGuard(
      authTokenService as unknown as AuthTokenService,
      reflector as unknown as Reflector,
      userService as unknown as UserService,
    );
  });

  function createContext(): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('会话和用户都有效时写入认证信息', async () => {
    await expect(guard.canActivate(createContext())).resolves.toBe(true);

    expect(userService.existsById).toHaveBeenCalledWith(7);
    expect(request.user).toEqual({ userId: 7, sessionId: 'session-id' });
  });

  it('会话对应用户不存在时拒绝访问', async () => {
    userService.existsById.mockResolvedValue(false);

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });
});
