/**
 * @author Brave
 * @date 2026-09-22 10:41:28
 * @description 默认分类实体
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AmountType } from '../../amount-records/enums/amount-type-enum';

@Entity('category')
export class CategoryTplEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // 分类所属的金额类型
  @Column({
    type: 'varchar',
    nullable: false,
  })
  type!: AmountType;

  // 父级分类id，一级分类为null，二级分类必须要有
  @Column({
    name: 'parent_id',
    type: 'int',
    nullable: true,
  })
  parentId!: number | null;

  // 分类名称
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  name!: string;

  // 默认排序
  @Column({
    name: 'default_sort',
    type: 'int',
    nullable: false,
  })
  defaultSort!: number;

  // 分类层级。1表示一级分类，2表示二级分类
  @Column({
    type: 'int',
    nullable: false,
  })
  level!: 1 | 2;

  // 图标资源
  @Column({
    name: 'icon_key',
    type: 'varchar',
    nullable: false,
    length: 100,
  })
  iconKey!: string;

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
