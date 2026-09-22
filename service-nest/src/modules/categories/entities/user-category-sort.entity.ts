/**
 * @author Brave
 * @date 2026-09-22 15:25:08
 * @description 用户分类排序表·
 */

import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_category_sort')
// 使用复合主键
export class UserCategorySortEntity {
  // 用户id
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
    nullable: false,
  })
  userId!: number;

  // 分类id
  @PrimaryColumn({
    name: 'category_id',
    type: 'int',
    nullable: false,
  })
  categoryId!: number;

  // 排序
  @Column({
    name: 'sort_order',
    type: 'int',
    nullable: false,
  })
  sortOrder!: number;

  // 更新时间
  @UpdateDateColumn({
    name: 'updated_time',
    type: 'datetime',
    nullable: false,
  })
  updatedTime!: Date;
}
