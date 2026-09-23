/**
 * @author Brave
 * @date 2026-09-23 11:52:47
 * @description 守卫完成鉴权后写入请求的用户信息。
 */

export interface AuthenticatedUser {
  // 用户id
  userId: number;

  // 登录会话id
  sessionId: string;
}
