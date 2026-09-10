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
import { VerificationPurpose } from '../enums/verification-purpose-enum';

// 定义实体类，映射到数据库表 user_verification_code
@Entity('user_verification_code')
export class UserVerificationCodeEntity {
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
  email!: string;

  // 验证码用途：register / change_password / delete_account / forgot_password
  @Column({
    type: 'varchar',
    length: 45,
  })
  purpose!: VerificationPurpose;

  // 验证码哈希，不存明文
  @Column({
    name: 'code_hash',
    type: 'varchar',
    length: 64,
    nullable: false,
  })
  codeHash!: string;

  // 过期时间
  @Column({
    name: 'expires_time',
    type: 'datetime',
    nullable: false,
  })
  expiresTime!: Date;

  // 核销时间(null表示未使用)
  @Column({
    name: 'consumed_time',
    type: 'datetime',
    nullable: true,
  })
  consumedTime!: Date | null;

  // 失效时间(null表示未被主动废弃，例如未被新验证码替代)
  @Column({
    name: 'invalidated_time',
    type: 'datetime',
    nullable: true,
  })
  invalidatedTime!: Date | null;

  // 创建时间
  @CreateDateColumn({
    name: 'created_time',
    type: 'datetime',
    nullable: false,
  })
  createdTime!: Date;
}
