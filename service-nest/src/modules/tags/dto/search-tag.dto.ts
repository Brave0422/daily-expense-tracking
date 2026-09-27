/**
 * @author Brave
 * @date 2026-09-27 20:36:10
 * @description 搜索标签dto
 */

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchTagQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '搜索关键词必须是字符串' })
  @IsNotEmpty({ message: '搜索关键词不能为空' })
  @MaxLength(50, { message: '搜索关键词不能超过50个字符' })
  key!: string;
}
