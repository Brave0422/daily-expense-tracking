/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description 鉴权与验证码接口的请求、响应契约类型。
 */

export type VerificationPurpose = 'register' | 'reset_password' | 'change_password'

export interface AccessTokenData {
  /** 短期访问令牌，只允许保存在运行时内存。 */
  accessToken: string
}

export interface LoginBody {
  /** 去除首尾空白并转为小写的邮箱。 */
  email: string
  /** 6–20 位明文密码，仅用于当前 HTTPS 请求。 */
  password: string
}

export interface RegisterBody extends LoginBody {
  /** 六位数字注册验证码。 */
  code: string
}

export interface ResetPasswordBody {
  /** 接收重置密码验证码的邮箱。 */
  email: string
  /** 六位数字重置密码验证码。 */
  code: string
  /** 6–20 位新密码。 */
  newPassword: string
}

export interface ChangePasswordBody {
  /** 六位数字修改密码验证码。 */
  code: string
  /** 6–20 位新密码。 */
  newPassword: string
}

export interface SendVerificationCodeBody {
  /** 验证码接收邮箱。 */
  email: string
  /** 决定验证码校验场景及接口是否需要登录态。 */
  purpose: VerificationPurpose
}
