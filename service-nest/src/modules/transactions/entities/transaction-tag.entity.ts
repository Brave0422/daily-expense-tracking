/**
 * @author Brave
 * @date 2026-09-30 10:00:42
 * @description 流水与标签的关联实体
 */

import { Entity, PrimaryColumn } from 'typeorm';

@Entity('transaction_tag')
export class TransactionTagEntity {
  @PrimaryColumn({
    type: 'int',
    nullable: false,
  })
  transactionId!: number;

  @PrimaryColumn({
    type: 'int',
    nullable: false,
  })
  tagId!: number;
}
