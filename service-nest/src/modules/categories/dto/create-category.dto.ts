/**
 * @author Brave
 * @date 2026-09-24 11:26:16
 * @description 创建分类dto
 */

import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AmountType } from 'src/modules/amount-records/enums/amount-type-enum';
import { IconKey } from '../enums/icon-key-enum';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  @IsString()
  @IsNotEmpty({ message: '分类名称不能为空' })
  name!: string;

  // 用于判断创建的是几级分类，为null表示一级
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @IsEnum(AmountType, { message: '分类类型不正确' })
  type!: AmountType;

  @IsEnum(IconKey, { message: '分类图标必须来自图标库' })
  @IsNotEmpty()
  iconKey!: IconKey;
}
