import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import type { RequestWithOptionalUser } from '../types/authenticated-request.type';

/**
 * 从当前HTTP请求中获取已认证用户。
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();

    if (!request.user) {
      throw new UnauthorizedException('请先登录');
    }

    return request.user;
  },
);

/**
 * 从当前HTTP请求中获取已认证用户id。
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();

    if (!request.user) {
      throw new UnauthorizedException('请先登录');
    }

    return request.user.userId;
  },
);

/**
 * 从当前HTTP请求中获取可选的已认证用户id。
 * 用于同一个接口同时支持公开访问和登录访问的场景。
 */
export const OptionalCurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();

    return request.user?.userId;
  },
);
