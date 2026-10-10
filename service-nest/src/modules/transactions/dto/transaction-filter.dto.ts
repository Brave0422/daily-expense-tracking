import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TransactionType } from '../enums/transaction-type-enum';
import { toIdArray, trimOptionalText } from '../util/query-transform.util';

// 非负金额：最多13位整数、2位小数，与 DECIMAL(15,2) 对齐。
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;

export class transactionFiltersDto {
  @IsOptional()
  @IsEnum(TransactionType, { message: '流水类型不正确' })
  type?: TransactionType;

  @Transform(({ value }: { value: unknown }) => toIdArray(value))
  @IsOptional()
  @IsArray()
  //   数组每一项都必须是数字
  @IsInt({ each: true })
  //   数组每一项的最小值为0
  @Min(0, { each: true })
  //   数组每一项的最大值为int的最大值
  @Max(Number.MAX_SAFE_INTEGER, { each: true })
  categoryIds?: number[];

  @Transform(({ value }: { value: unknown }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  @Matches(AMOUNT_PATTERN, {
    message: '最小金额必须是非负金额字符串，最多13位整数和2位小数',
  })
  minAmount?: string;

  @Transform(({ value }: { value: unknown }) => trimOptionalText(value))
  @IsOptional()
  @IsString()
  @Matches(AMOUNT_PATTERN, {
    message: '最大金额必须是非负金额字符串，最多13位整数和2位小数',
  })
  maxAmount?: string;
}
