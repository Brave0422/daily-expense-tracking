/**
 * @author Brave
 * @date 2026-09-27 11:04:34
 * @description 流水标签表
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tags')
export class TagEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // 所属用户id
  @Column({
    name: 'owner_user_id',
    type: 'int',
    nullable: false,
  })
  ownerUserId!: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  name!: string;

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
