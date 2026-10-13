/** 流水路径id校验，避免全局隐式转换接受科学计数法或空白。 */
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class TransactionIdParamDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && !/\D/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '流水id必须是正整数' })
  @Min(1, { message: '流水id必须是正整数' })
  @Max(Number.MAX_SAFE_INTEGER, { message: '流水id超出有效范围' })
  id!: number;
}
