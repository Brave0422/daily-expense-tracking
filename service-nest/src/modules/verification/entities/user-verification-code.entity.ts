/**
 * @author Brave
 * @date 2026-09-08 10:51:54
 * @description 验证码实体，对应验证码表
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 定义实体类，映射到数据库表 user_verification_code
@Entity('user_verification_code')
export class UserVerificationCode {
  // 主键列，自增ID
  @PrimaryGeneratedColumn()
  id!: number;

  // 关联的用户ID（注册验证码时为 null）

  @Column({
    // 数据库列名
    name: 'user_id',
    type: 'int',
    // 允许为空
    nullable: true,
  })
  userId!: number | null;

  // 目标邮箱
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  emial!: string;

  // 验证码用途：register / change_password / delete_account / forgot_password
  @Column({
    type: 'string',
    length: 45,
  })
  purpose!: string;

  // 验证码哈希，不存明文
  @Column({
    name: 'code_hase',
    type: 'string',
    length: 255,
    nullable: false,
  })
  codeHash!: string;

  // 过期时间
  @Column({
    name: 'exprise_time',
    type: 'datetime',
    nullable: false,
  })
  expriseTime!: Date;

  // 核销时间(null表示未使用)
  @Column({
    name: 'consumed_time',
    type: 'datetime',
    nullable: true,
  })
  consumedTime!: Date | null;

  // 创建时间
  @CreateDateColumn({
    name: 'created_time',
    type: 'datetime',
    nullable: false,
  })
  CreatedTime!: Date;
}
