/**
 * @author Brave
 * @date 2026-09-10 14:55:43
 * @description 发送验证码DTO
 */

import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsEnum, ValidateIf } from 'class-validator';
import { VerificationPurpose } from '../enums/verification-purpose-enum';

export class SendVerificationCodeDto {
  // 修改密码和删除账户时由服务端根据登录态获取邮箱，其他场景必须携带。
  @ValidateIf(
    (body: SendVerificationCodeDto) =>
      ![
        VerificationPurpose.CHANGE_PASSWORD,
        VerificationPurpose.DELETE_ACCOUNT,
      ].includes(body.purpose),
  )
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email?: string;

  // 验证码用途
  @IsEnum(VerificationPurpose, {
    message: '验证码用途不正确',
  })
  purpose!: VerificationPurpose;
}
