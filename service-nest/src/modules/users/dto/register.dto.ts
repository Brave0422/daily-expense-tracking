/**
 * @author Brave
 * @date 2026-9-4 17:18:16
 * @description 用户注册接口的请求参数验证，包含邮箱、密码和注册验证码
 */

import { Transform, Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class RegisterDto {
  // 去空并转换成小写
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsString()
  @Type(() => String)
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;

  @Length(6, 20, { message: '密码长度要在6~20之间' })
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}
