/**
 * @author Brave
 * @date 2026-09-29 16:52:41
 * @description 流水记录实体
 */

import { UserEntity } from '../../users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionType } from '../enums/transaction-type-enum';
import { UserCategoryEntity } from '../../categories/entities/user-category.entity';
import { TransactionTagEntity } from './transaction-tag.entity';

@Entity('transactions')
export class TransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // 一条流水可以关联多个标签；关联表实体中保存流水id和标签id
  @OneToMany(
    () => TransactionTagEntity,
    (transactionTag) => transactionTag.transaction,
  )
  transactionTag!: TransactionTagEntity[];

  // 与用户表建立外键owner_user_id，关联的是users表的主键
  @ManyToOne(() => UserEntity)
  @JoinColumn({
    name: 'owner_user_id',
  })
  user!: UserEntity;
  // 数据库里指向同一个owner_user_id，不会创建两个字段，所以ownerUserId可以不写其他属性
  @Column({
    name: 'owner_user_id',
  })
  ownerUserId!: number;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  type!: TransactionType;

  // 金额
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  amount!: number;

  // 与用户分类表建立外键category_id，关联的是user_categories表主键
  @ManyToOne(() => UserCategoryEntity)
  @JoinColumn({
    name: 'category_id',
  })
  category!: UserCategoryEntity;
  @Column({
    name: 'category_id',
  })
  categoryId!: number;

  // 标题
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  title?: string;

  // 备注
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  remark?: string;

  //   流水实际发生的日期
  @Column({
    name: 'occurred',
    type: 'date',
    nullable: false,
  })
  occurredDate!: Date;

  // 归档时间(软删除)，null表示未归档
  @Column({
    name: 'archived_time',
    type: 'datetime',
    nullable: true,
  })
  archivedTime!: Date | null;

  // 创建时间
  @CreateDateColumn({
    name: 'created_time',
    type: 'datetime',
    nullable: false,
  })
  createdTime!: Date;

  // 更新时间
  @UpdateDateColumn({
    name: 'updated_time',
    type: 'datetime',
    nullable: false,
  })
  updatedTime!: Date;
}
