/**
 * @author Brave
 * @date 2026-09-24 16:53:49
 * @description 编辑用户分类dto
 */

import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, MaxLength, Min } from 'class-validator';
import { IconKey } from '../enums/icon-key-enum';

export class updateCategory {
  @Min(1)
  @IsInt()
  @IsNotEmpty()
  id!: number;

  @Transform(({ value }: { value: unknown }) => {
    return typeof value === 'string' ? value.trim() : value;
  })
  @MaxLength(50)
  @IsNotEmpty({ message: '缺少分类名称' })
  name!: string;

  @IsEnum(IconKey, { message: '分类图标必须来自图标库' })
  @IsNotEmpty()
  iconKey!: IconKey;
}
