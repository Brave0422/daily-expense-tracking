/**
 * @author Brave
 * @date 2026-09-22 15:25:08
 * @description 用户分类表
 */

import { AmountType } from 'src/modules/amount-records/enums/amount-type-enum';
import {
  Column,
  Entity,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ForeignKey,
} from 'typeorm';
import { CategoryIconEntity } from './category-icon.entity';

@Entity('user_category')
export class UserCategoryEntity {
  // id
  @PrimaryGeneratedColumn()
  id!: number;

  // 所属用户id
  @Column({
    name: 'owner_user_id',
    type: 'int',
    nullable: false,
  })
  ownerUserId!: number;

  // 默认模板来源；非NULL表示默认来源分类，NULL表示用户自定义分类
  @Column({
    name: 'source_template_id',
    type: 'int',
    nullable: true,
  })
  sourceTplId!: number | null;

  // 分类所属的金额类型
  @Column({
    type: 'varchar',
    length: 20,
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

  // 排序
  @Column({
    name: 'sort_order',
    type: 'int',
    nullable: false,
  })
  sortOrder!: number;

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
  // 建立外键
  @ForeignKey(() => CategoryIconEntity, 'iconKey', {
    name: 'fk_user_category_icon_key',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
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
