/** 编辑流水必须完整提交可编辑字段，空文本使用 NULL 或空字符串。 */
import { Transform } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsDateString,
  IsDefined,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateTransactionDto {
  // 全局 whitelist 会移除未知字段；显式校验 type，避免修改类型被静默忽略。
  @Equals(undefined, { message: '流水类型不允许修改' })
  type?: never;

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

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined({ message: '请完整提交标题，留空时传 null 或空字符串' })
  @IsString({ message: '标题必须是字符串' })
  @MaxLength(50, { message: '标题不能超过50个字符' })
  title!: string | null;

  @IsArray({ message: '请完整提交标签id数组，无标签时传空数组' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(Number.MAX_SAFE_INTEGER, { each: true })
  tagIds!: number[];

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined({ message: '请完整提交备注，留空时传 null 或空字符串' })
  @IsString({ message: '备注必须是字符串' })
  @MaxLength(100, { message: '备注不能超过100个字符' })
  remark!: string | null;
}
