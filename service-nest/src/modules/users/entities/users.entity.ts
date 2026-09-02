/**
 * @author Brave
 * @date 2026-9-2 16:48:58
 * @description 用户实体，对应数据库表 users
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// 定义实体类，映射到数据库表 users
@Entity('users')
export class UserEntity {
  // 主键列，自增ID
  @PrimaryGeneratedColumn()
  id!: number;

  // 用户邮箱，也是账号
  @Column({
    // 列类型
    type: 'varchar',
    // 最大长度
    length: 100,
    // 不可为空
    nullable: false,
    // 唯一约束
    unique: true,
  })
  email!: string;

  // 密码哈希值，bcrypt哈希后的结果
  @Column({
    // 数据库列名
    name: 'password_hash',
    // 列类型为可变长度字符串
    type: 'varchar',
    // 最大长度255
    length: 255,
    // 不可为空
    nullable: false,
  })
  passwordHash!: string;

  //   创建时间，自动增加
  @CreateDateColumn({
    // 数据库列名
    name: 'created_time',
    // 不可为空
    nullable: false,
  })
  createdTime!: Date;

  @UpdateDateColumn({
    // 数据库列名
    name: 'update_time',
    // 不可为空
    nullable: false,
  })
  updateTime!: Date;
}
