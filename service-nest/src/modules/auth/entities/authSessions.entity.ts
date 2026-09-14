/**
 * @author Brave
 * @date 2026-09-14 16:44:42
 * @description refresh token的会话实体
 */

import { Column, Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('auth_sessions')
export class AuthSessionsEntity {
  // 主键
  @PrimaryColumn()
  id!: number;

  // sessionId
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
  })
  sid!: string;

  // userId
  @Column({
    name: 'user_id',
    type: 'int',
    nullable: false,
    unique: true,
  })
  userId!: number;

  // token的hash值
  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  refreshTokenHash!: string;

  // 过期时间
  @Column({
    // 数据库列名
    name: 'expires_time',
    // 不可为空
    nullable: false,
  })
  expiresTime!: Date;

  // 取消时间。因为刷新token会生成新的token，原本的失效，这里记录失效时间
  @Column({
    // 数据库列名
    name: 'revoked_time',
    // 不可为空
    nullable: true,
  })
  revokedTime!: Date | null;

  // 创建时间，自动增加
  @CreateDateColumn({
    // 数据库列名
    name: 'created_time',
    // 不可为空
    nullable: false,
  })
  createdTime!: Date;
}
