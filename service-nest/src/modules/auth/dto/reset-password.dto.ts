/**
 * @author Brave
 * @date 2026-09-18 15:36:57
 * @description 重置密码dto。包含邮箱、新密码、验证码
 */
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPassword {
  // 去空并转换成小写
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  @IsString()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;

  @Length(6, 20, { message: '密码长度要在6~20之间' })
  @IsNotEmpty({ message: '密码不能为空' })
  newPassword!: string;

  @IsNotEmpty({ message: '验证码不能为空' })
  code!: string;
}
