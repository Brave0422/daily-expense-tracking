/**
 * @author Brave
 * @date 2026-10-12T22:08:32+08:00
 * @description 创建流水的请求校验，金额与业务日期按字符串传输
 */

import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from '../enums/transaction-type-enum';

/**
 * 去除文本首尾空格，保留 NULL 和非字符串值供校验器检查。
 *
 * @param value 请求中原始的标题或备注值
 * @returns 去除首尾空格后的字符串；非字符串原样返回
 */
function trimText(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateTransactionDto {
  @IsEnum(TransactionType, { message: '流水类型不正确' })
  type!: TransactionType;

  @IsInt({ message: '分类id必须是正整数' })
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId!: number;

  @IsString({ message: '金额必须是字符串' })
  @Matches(/^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/, {
    message: '金额必须大于0，最多13位整数和2位小数',
  })
  amount!: string;

  @Matches(/^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: '发生日期必须是 YYYY-MM-DD 格式的有效日期',
  })
  @IsDateString({ strict: true }, { message: '发生日期必须是有效的自然日期' })
  occurredDate!: string;

  @Transform(({ value }: { value: unknown }) => trimText(value))
  @IsOptional()
  @IsString({ message: '标题必须是字符串' })
  @MaxLength(50, { message: '标题不能超过50个字符' })
  title?: string | null;

  // NULL 不是“不绑定标签”；只有省略或空数组符合服务层契约。
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray({ message: '标签id必须是正整数数组' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(Number.MAX_SAFE_INTEGER, { each: true })
  tagIds?: number[];

  @Transform(({ value }: { value: unknown }) => trimText(value))
  @IsOptional()
  @IsString({ message: '备注必须是字符串' })
  @MaxLength(100, { message: '备注不能超过100个字符' })
  remark?: string | null;
}
