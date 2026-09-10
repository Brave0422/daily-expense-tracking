/**
 * @author Brave
 * @date 2026-09-10 15:14:05
 * @description 验证码用途枚举
 */
export enum VerificationPurpose {
  // 注册
  REGISTER = 'register',
  //   修改密码
  CHANGE_PASSWORD = 'change_password',
  //   注销账号
  DELETE_ACCOUNT = 'delete_account',
  //   忘记密码
  FORGOT_PASSWORD = 'forgot_password',
}
