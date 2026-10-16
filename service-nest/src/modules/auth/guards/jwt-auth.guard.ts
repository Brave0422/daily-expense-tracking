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
import { VerificationPurpose } from '../../verification-codes/enums/verification-purpose-enum';
import { UsersService } from '../../users/users.service';
import type { RequestWithOptionalUser } from '../types/authenticated-request.type';
import { API_PREFIX } from '../../../common/constants/api.constants';

interface VerificationCodeRequestBody {
  purpose?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  /**
   * 初始化 JwtAuthGuard 的依赖。
   *
   * @param authTokenService 处理 token 签发、验证和会话存储的服务
   * @param reflector 读取路由装饰器元数据的反射工具
   * @param usersService 提供用户查询和持久化操作的服务
   */
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 校验 access token、有效会话和用户存在性，并将身份写入请求上下文。
   *
   * @param context 当前路由的执行上下文，用于读取公开标记和 HTTP 请求
   * @returns 公开接口或认证成功时返回 true；认证失败时抛出异常
   */
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
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser<VerificationCodeRequestBody>>();

    // 发送验证码请求,如果是注册和重置密码不用鉴权,其他需要鉴权
    const path = request.path;
    const codePurpose = request.body?.purpose;
    const publicPurposes: readonly string[] = [
      VerificationPurpose.REGISTER,
      VerificationPurpose.RESET_PASSWORD,
    ];
    if (
      path === `/${API_PREFIX}/verification-codes/send` &&
      typeof codePurpose === 'string' &&
      publicPurposes.includes(codePurpose)
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

    // 查询 access token 对应的有效登录会话
    const session = await this.authTokenService.findSessionBySid(
      payload,
      userId,
    );

    if (!session) {
      throw new UnauthorizedException('登录状态已失效');
    }

    // 所有受保护接口统一在认证边界确认用户仍然存在，业务服务无需重复查询。
    const userExists = await this.usersService.existsById(userId);

    if (!userExists) {
      throw new UnauthorizedException('登录状态已失效');
    }

    // 写入请求中，给后面的 Controller、日志拦截器使用
    request.user = {
      userId,
      sessionId: payload.sid,
    };

    return true;
  }

  /**
   * 从 Authorization 请求头提取 Bearer access token。
   *
   * @param request 包含 Authorization 请求头的 HTTP 请求对象
   * @returns 有效格式的 token 字符串；没有 Bearer 凭证时返回 undefined
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
