/**
 * @author Brave
 * @date 2026-09-23 11:31:35
 * @description 查询用户分类dto
 */

import { IsEnum } from 'class-validator';
import { AmountType } from 'src/modules/amount-records/enums/amount-type-enum';

export class FindUserCategory {
  @IsEnum(AmountType, {
    message: '分类类型不正确',
  })
  type?: AmountType;
}
