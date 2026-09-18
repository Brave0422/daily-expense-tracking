/**
 * @author Brave
 * @date 2026-09-18 14:31:03
 * @description 操作密码相关的业务逻辑
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserService } from 'src/modules/users/users.service';
import { VerificationPurpose } from 'src/modules/verification-code/enums/verification-purpose-enum';
import { VerificationCodeService } from 'src/modules/verification-code/verification-code.service';
import { hash, compare } from 'bcrypt';
import { UserEntity } from 'src/modules/users/entities/users.entity';

@Injectable()
export class PasswordService {
  constructor(
    private readonly userService: UserService,
    private readonly verificationService: VerificationCodeService,
  ) {}

  /**
   * 哈希密码
   * @param password 密码
   * @returns 密码哈希值
   */
  public async hashPassword(password: string): Promise<string> {
    // 使用bcrypt加盐哈希，盐轮数为10
    return await hash(password, 10);
  }

  /**
   * 匹配密码
   * @param inputPassword 用户输入的明文密码
   * @param passwordHash 数据存储的密码哈希
   * @returns 比较结果
   */
  public async comparePassword(
    inputPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await compare(inputPassword, passwordHash);
  }

  /**
   * 检查验证码并且哈希密码
   * @param email 邮箱
   * @param purpose 验证码用途
   * @param code 验证码
   * @param newPassword 新密码
   * @returns 密码哈希
   */
  async checkCodeAndHash(
    email: string,
    purpose: VerificationPurpose,
    code: string,
    newPassword: string,
  ): Promise<string> {
    // 校验验证码
    await this.verificationService.verifyAndConsume(email, purpose, code);

    // 对密码进行哈希处理
    return await this.hashPassword(newPassword);
  }

  /**
   * 修改密码
   * @param email 邮箱
   * @param newPassword 新密码
   * @param code 验证码
   * @param purpose 验证码用途
   */
  async changePassword(
    userId: number,
    newPassword: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<boolean> {
    // 根据id查询用户
    const user = await this.userService.findeOneById(userId);

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    await this.updatePassword(user, purpose, code, newPassword);
    return true;
  }

  /**
   * 重置密码
   * @param email 邮箱
   * @param newPassword 新密码
   * @param code 验证码
   * @param purpose 验证码用途
   * @returns 重置成功
   */
  async resetPassword(
    email: string,
    newPassword: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<boolean> {
    // 根据邮箱查询用户
    const user = await this.userService.findOneByEmail(email);

    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    await this.updatePassword(user, purpose, code, newPassword);
    return true;
  }

  /**
   * 更新密码
   * @param user 用户实体
   * @param purpose 验证码用途
   * @param code 验证码
   * @param password 密码
   */
  async updatePassword(
    user: UserEntity,
    purpose: VerificationPurpose,
    code: string,
    password: string,
  ): Promise<void> {
    const passwordHash = await this.checkCodeAndHash(
      user.email,
      purpose,
      code,
      password,
    );

    try {
      await this.userService.updatePassword(user.id, passwordHash);
    } catch {
      throw new InternalServerErrorException('重置密码失败');
    }
  }
}
