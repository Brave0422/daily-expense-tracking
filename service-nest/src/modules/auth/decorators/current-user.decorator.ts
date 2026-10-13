import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import type { RequestWithOptionalUser } from '../types/authenticated-request.type';

/**
 * 创建从当前 HTTP 请求中注入已认证用户的参数装饰器。
 *
 * @param dataOrPipes 可选装饰器数据或参数管道；数据本身未参与身份查询
 * @returns 注入认证用户的参数装饰器；执行时未登录则抛出401异常
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
 * 创建从当前 HTTP 请求中注入已认证用户id的参数装饰器。
 *
 * @param dataOrPipes 可选装饰器数据或参数管道；数据本身未参与身份查询
 * @returns 注入认证用户id的参数装饰器；执行时未登录则抛出401异常
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
 * 创建从当前 HTTP 请求中注入可选认证用户id的参数装饰器。
 * 用于同一个接口同时支持公开访问和登录访问的场景。
 *
 * @param dataOrPipes 可选装饰器数据或参数管道；数据本身未参与身份查询
 * @returns 注入用户id的参数装饰器；执行时未登录则注入 undefined
 */
export const OptionalCurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();

    return request.user?.userId;
  },
);
