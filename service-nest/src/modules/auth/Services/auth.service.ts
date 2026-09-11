/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { UserService } from '../../users/users.service';
import { VerificationCodeService } from '../../verification-code/verification-code.service';
import { VerificationPurpose } from '../../verification-code/enums/verification-purpose-enum';

@Injectable()
export class AuthService {
  constructor(
    // 注入用户服务
    private readonly userService: UserService,
    // 注入验证码服务
    private readonly verificationService: VerificationCodeService,
  ) {}

  private hashPassword(password: string): Promise<string> {
    // 使用bcrypt加盐哈希，盐轮数为10
    return hash(password, 10);
  }

  /**
   * 用户注册（两步式：需先通过 sendRegisterCode 获取验证码）
   * @param email - 邮箱
   * @param password - 明文密码
   * @param code - 注册验证码
   * @returns 注册成功消息
   */
  async register(
    email: string,
    password: string,
    code: string,
  ): Promise<boolean> {
    // 检查邮箱是否已注册
    const existingUser = await this.userService.findByEmail(email);

    // 如果邮箱已存在则抛出冲突异常
    if (existingUser) throw new ConflictException('该邮箱已被注册');

    // 校验验证码
    await this.verificationService.verifyAndConsume(
      email,
      VerificationPurpose.REGISTER,
      code,
    );

    try {
      // 对密码进行哈希处理
      const passwordHash = await this.hashPassword(password);

      // 创建用户实体
      const user = this.userService.create(email, passwordHash);

      // 保存用户
      await this.userService.save(user);

      return true;
    } catch {
      throw new InternalServerErrorException('注册失败');
    }
  }
}
