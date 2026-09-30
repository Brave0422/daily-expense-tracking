/**
 * @author Brave
 * @date 2026-09-23 11:31:35
 * @description 查询用户分类dto
 */

import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { TransactionType } from 'src/modules/transactions/enums/transaction-type-enum';

export class FindUserCategory {
  @IsEnum(TransactionType, {
    message: '分类类型不正确',
  })
  type!: TransactionType;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean({ message: '是否包含已归档分类必须是布尔值' })
  includeArchived?: boolean;
}
