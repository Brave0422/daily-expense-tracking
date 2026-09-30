/**
 * @author Brave
 * @date 2026-09-30 10:00:42
 * @description 流水与标签的关联实体
 */

import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TransactionEntity } from './transaction.entity';
import { TagEntity } from 'src/modules/tags/entities/tag.entity';

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

  @ManyToOne(() => TransactionEntity)
  @JoinColumn({
    name: 'transaction_id',
  })
  transactions!: TransactionEntity[];

  @ManyToOne(() => TagEntity)
  @JoinColumn({
    name: 'tag_id',
  })
  tags!: TagEntity[];
}
