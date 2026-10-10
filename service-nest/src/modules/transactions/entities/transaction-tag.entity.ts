/**
 * @author Brave
 * @date 2026-09-30 10:00:42
 * @description 流水与标签的关联实体
 */

import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TransactionEntity } from './transaction.entity';
import { TagEntity } from '../../tags/entities/tag.entity';

@Entity('transaction_tags')
export class TransactionTagEntity {
  // 这里使用transactionId和tagId联合组建

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

  @ManyToOne(
    () => TransactionEntity,
    (transaction) => transaction.transactionTag,
  )
  @JoinColumn({
    name: 'transaction_id',
  })
  transaction!: TransactionEntity;

  @ManyToOne(() => TagEntity, (tag) => tag.transactionTag)
  @JoinColumn({
    name: 'tag_id',
  })
  tag!: TagEntity;
}
