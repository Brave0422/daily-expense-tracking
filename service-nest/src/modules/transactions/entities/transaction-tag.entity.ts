/**
 * @author Brave
 * @date 2026-09-30 10:00:42
 * @description 流水与标签的关联实体
 */

import { Entity, PrimaryColumn } from 'typeorm';

@Entity('transaction_tags')
export class TransactionTagEntity {
  @PrimaryColumn({
    name: 'transaction_id',
    type: 'int',
    nullable: false,
  })
  transactionId!: number;

  @PrimaryColumn({
    name: 'tag_id',
    type: 'int',
    nullable: false,
  })
  tagId!: number;
}
