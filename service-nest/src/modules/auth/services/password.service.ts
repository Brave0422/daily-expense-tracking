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
import { UsersService } from 'src/modules/users/users.service';
import { VerificationPurpose } from 'src/modules/verification-codes/enums/verification-purpose-enum';
import { VerificationCodesService } from 'src/modules/verification-codes/verification-codes.service';
import { hash, compare } from 'bcrypt';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Injectable()
export class PasswordService {
  /**
   * 初始化 PasswordService 的依赖。
   *
   * @param usersService 提供用户查询和持久化操作的服务
   * @param verificationCodesService 处理验证码发送、核验和核销的服务
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly verificationCodesService: VerificationCodesService,
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
    await this.verificationCodesService.verifyAndConsume(email, purpose, code);

    // 对密码进行哈希处理
    return await this.hashPassword(newPassword);
  }

  /**
   * 修改密码
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param newPassword 待设置的明文新密码
   * @param code 修改密码验证码
   * @param purpose 当前验证码的业务用途
   * @returns 验证码核销并保存新密码成功时返回 true；失败时抛出异常
   */
  async changePassword(
    userId: number,
    newPassword: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<boolean> {
    // 当前接口需要用户邮箱，复用用户模块的统一必查方法。
    const user = await this.usersService.findOneByIdOrThrow(userId);

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
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    await this.updatePassword(user, purpose, code, newPassword);
    return true;
  }

  /**
   * 更新密码
   *
   * @param user 需要修改密码的用户实体
   * @param purpose 当前验证码的业务用途
   * @param code 用户提交的验证码
   * @param password 待哈希并保存的明文新密码
   * @returns 验证码核销并保存密码哈希后异步结束，无返回值
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
      await this.usersService.updatePassword(user.id, passwordHash);
    } catch {
      throw new InternalServerErrorException('重置密码失败');
    }
  }
}
