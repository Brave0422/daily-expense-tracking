/**
 * @author Brave
 * @date 2026-09-17 10:19:16
 * @description 鉴权守卫，判断token并从中获取userId写入请求
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthTokenService } from '../services/auth-token.service';
import { Reflector } from '@nestjs/core';
import { Public } from '../decorators/public.decorator';
import { VerificationPurpose } from 'src/modules/verification-code/enums/verification-purpose-enum';

export interface AuthenticatedUser {
  id: number;
}

// 声明权限请求类型
type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取路由中的元数据，如果是公共接口，不用鉴权
    const isPublic = this.reflector.getAllAndOverride(Public, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取请求体
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    console.log('path', request.path, 'body', request.body);

    // 发送验证码请求,如果是注册和忘记密码不用鉴权,其他需要鉴权
    const path = request.path;
    const codePurpose = request.body.purpose;
    const publicPath = [
      VerificationPurpose.REGISTER,
      VerificationPurpose.FORGOT_PASSWORD,
    ];
    if (
      path === '/auth/changePassword' &&
      codePurpose &&
      publicPath.includes(codePurpose)
    ) {
      return true;
    }

    // 从请求中获取access token
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    // 校验token并提取playload
    const payload = await this.authTokenService.verifyAccessToken(token);

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('登录状态已失效');
    }

    // 写入请求中，给后面的 Controller、日志拦截器使用
    request.user = {
      id: userId,
    };

    return true;
  }

  /**
   * 从请求体中提取jwt
   * @param request 请求体
   * @returns access token
   */
  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    // 提取token。jwt通过bearer传输：Bearer eyJhbGciOiJIUzI1...
    const [scheme, token] = authorization.trim().split(/\s+/);

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }
    return token;
  }
}
