/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/users.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService {
  constructor(
    // 注入用户实体的仓库
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * 根据邮箱查找用户。
   */
  findOneByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOneBy({ email });
  }

  /**
   * 创建用户实体，但不立即持久化。
   */
  create(email: string, passwordHash: string): UserEntity {
    return this.userRepo.create({
      email,
      passwordHash,
    });
  }

  /**
   * 保存用户实体。
   */
  save(user: UserEntity): Promise<UserEntity> {
    return this.userRepo.save(user);
  }
}
