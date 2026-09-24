/**
 * @author Brave
 * @date 2026-09-24 10:45:27
 * @description 分类图标库实体
 */

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('category_icon')
export class CategoryIconEntity {
  // 完整 Iconfont Symbol ID
  @PrimaryColumn({
    name: 'icon_key',
    type: 'varchar',
    length: 100,
  })
  iconKey!: string;

  // icon名称，仅用于种子数据、开发排查和资源维护，不返回前端
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  name!: string;

  // 图标自身固定的默认圆形背景色，格式为 #RRGGBB
  @Column({
    name: 'background_color',
    type: 'char',
    length: 7,
    nullable: false,
  })
  backgroundColor!: string;

  // 图标选择器中的固定展示顺序
  @Column({
    name: 'default_sort',
    type: 'int',
    nullable: false,
  })
  defaultSort!: number;
}
