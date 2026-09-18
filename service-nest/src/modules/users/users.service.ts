/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
   * 根据id查找用户
   * @param id 用户id
   * @returns 用户实体
   */
  findeOneById(id: number): Promise<UserEntity | null> {
    return this.userRepo.findOneBy({ id });
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

  /**
   * 修改用户密码
   * @param userId 用户id
   * @param passwordHash 新密码哈希
   */
  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const result = await this.userRepo.update(userId, {
      passwordHash,
    });
    if (result.affected !== 1) {
      throw new InternalServerErrorException('修改密码失败');
    }
  }
}
