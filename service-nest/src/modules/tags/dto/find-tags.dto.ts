/**
 * @author Brave
 * @date 2026-09-30T14:25:01+08:00
 * @description 标签列表查询参数，控制是否包含已归档标签。
 */

import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class FindTagsDto {
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean({ message: '是否包含已归档标签必须是布尔值' })
  includeArchived?: boolean;
}
