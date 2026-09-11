/**
 * @author Brave
 * @date 2026-09-11 15:44:55
 * @description 登录dto
 */
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
export class LoginDto {
  // 邮箱
  // 去空并转换成小写
  @Transform(({ value }: TransformFnParams): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  @IsString()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;

  // 密码
  @Length(6, 20, { message: '密码长度要在6~20之间' })
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}
