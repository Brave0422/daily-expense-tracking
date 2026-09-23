/**
 * @author Brave
 * @date 2026-09-23 11:52:47
 * @description 带权限信息的请求类型
 */


import type { Request } from 'express';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * 可能包含鉴权信息的请求。
 *
 * 守卫执行期间，以及同时支持公开和登录访问的接口，应使用该类型。
 */
export type RequestWithOptionalUser<TBody = unknown> = Request<
  Record<string, string>,
  unknown,
  TBody
> & {
  user?: AuthenticatedUser;
};

/**
 * 已通过鉴权、一定包含用户信息的请求。
 */
export type AuthenticatedRequest<TBody = unknown> = Request<
  Record<string, string>,
  unknown,
  TBody
> & {
  user: AuthenticatedUser;
};
