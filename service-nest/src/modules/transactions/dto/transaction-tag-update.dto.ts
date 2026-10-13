/**
 * @author Brave
 * @date 2026-10-13T19:51:36+08:00
 * @description 随流水保存的已有标签改名请求，校验标签id及规范化后的名称。
 */
import { IsInt, Max, Min } from 'class-validator';
import { TagNameDto } from '../../tags/dto/tag-name.dto';

export class TransactionTagUpdateDto extends TagNameDto {
  @IsInt({ message: '标签id必须是正整数' })
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  id!: number;
}
