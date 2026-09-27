/**
 * @author Brave
 * @date 2026-09-27T13:08:05+08:00
 * @description 标签名称请求DTO，供创建和编辑标签接口复用。
 */

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TagNameDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(50, { message: '标签名称不能超过50个字符' })
  @IsString({ message: '标签名称必须是字符串' })
  @IsNotEmpty({ message: '标签名称不能为空' })
  name!: string;
}
