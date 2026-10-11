/**
 * @author Brave
 * @date 2026-10-08 12:05:58
 * @description 以日为单位查询流水dto
 */

import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { transactionFiltersDto } from './transaction-filter.dto';
import { Transform } from 'class-transformer';
import { toIdArray, trimOptionalText } from '../util/query-transform.util';

export class DailyTransactionsQueryDto extends transactionFiltersDto {
  @Transform(({ value }: { value: unknown }) => toIdArray(value))
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(Number.MAX_SAFE_INTEGER, { each: true })
  tagIds?: number[];

  @Transform(({ value }: { value: unknown }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  @Transform(({ value }: { value: unknown }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  remark?: string;

  @IsNotEmpty({ message: '查询月份不能为空' })
  @IsString({ message: '查询月份必须是字符串' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '查询月份格式必须为 YYYY-MM，例如 2026-10',
  })
  month!: string;
}
