/**
 * @author Brave
 * @date 2026-09-18 11:02:50
 * @description 修改密码dto。包含邮箱、新密码、验证码
 */

import { IsNotEmpty, Length } from 'class-validator';

export class changePasswordDto {
  @Length(6, 20, { message: '密码长度要在6~20之间' })
  @IsNotEmpty({ message: '密码不能为空' })
  newPassword!: string;

  @IsNotEmpty({ message: '验证码不能为空' })
  code!: string;
}
