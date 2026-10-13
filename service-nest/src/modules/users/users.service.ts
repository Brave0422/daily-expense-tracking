/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  /**
   * 初始化 UsersService 的依赖。
   *
   * @param userRepo 用户实体仓库
   */
  constructor(
    // 注入用户实体的仓库
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * 根据邮箱查找用户。
   *
   * @param email 需要查询的用户邮箱
   * @returns 匹配邮箱的用户实体；不存在时返回 null
   */
  findOneByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOneBy({ email });
  }

  /**
   * 根据id查找用户，不存在时终止当前业务流程。
   * @param id 用户id
   * @returns 用户实体
   */
  async findOneByIdOrThrow(id: number): Promise<UserEntity> {
    const user = await this.userRepo.findOneBy({ id });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    return user;
  }

  /**
   * 判断用户是否存在，只查询存在性而不加载用户字段。
   * @param id 用户id
   * @returns 用户存在时返回true
   */
  existsById(id: number): Promise<boolean> {
    return this.userRepo.existsBy({ id });
  }

  /**
   * 创建用户实体，但不立即持久化。
   *
   * @param email 用户邮箱
   * @param passwordHash 已经完成哈希处理的密码
   * @returns 尚未持久化的用户实体
   */
  create(email: string, passwordHash: string): UserEntity {
    return this.userRepo.create({
      email,
      passwordHash,
    });
  }

  /**
   * 保存用户实体。
   *
   * @param user 需要新增或更新的用户实体
   * @returns 数据库保存后的用户实体，包含生成或更新的字段
   */
  save(user: UserEntity): Promise<UserEntity> {
    return this.userRepo.save(user);
  }

  /**
   * 修改用户密码
   *
   * @param userId 需要修改密码的用户id
   * @param passwordHash 待保存的新密码哈希
   * @returns 恰好一个用户的密码更新成功后异步结束，无返回值；更新失败时抛出异常
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
