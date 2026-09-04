/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import { ConflictException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    // 注入用户实体的仓库
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    // 使用bcrypt加盐哈希，盐轮数为10
    return bcrypt.hash(password, 10);
  }

  /**
   * 用户注册（两步式：需先通过 sendRegisterCode 获取验证码）
   * @param email - 邮箱
   * @param password - 明文密码
   * @param code - 注册验证码
   * @returns 注册成功消息
   */
  async register(email: string, password: string) {
    // 检查邮箱是否已注册
    const existingUser = await this.userRepo.findOneBy({
      email,
    });

    // 如果邮箱已存在则抛出冲突异常
    if (existingUser) throw new ConflictException('该邮箱已被注册');

    try {
      // 对密码进行哈希处理
      const passwordHash = await this.hashPassword(password);

      // 创建用户实体
      const user = this.userRepo.create({
        email,
        passwordHash,
      });

      // 保存用户
      await this.userRepo.save(user);

      return true;
    } catch (error) {}
  }
}
