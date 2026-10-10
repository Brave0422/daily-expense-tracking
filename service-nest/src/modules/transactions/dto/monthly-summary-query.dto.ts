/**
 * @author Brave
 * @date 2026-10-08 15:12:25
 * @description 以月为单位查询流水dto
 */

import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { transactionFiltersDto } from './transaction-filter.dto';

export class MonthlySummaryQueryDto extends transactionFiltersDto {
  @IsNotEmpty({ message: '查询年份不能为空' })
  @IsString({ message: '查询年份必须是字符串' })
  @Matches(/^\d{4}$/, {
    message: '查询年份格式必须为四位数字，例如 2026',
  })
  year!: string;
}
