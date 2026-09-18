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
   * 检查邮箱存在性和验证码是否匹配
   * @param email - 邮箱
   * @param password - 明文密码
   * @param code - 注册验证码
   * @param purpose - 验证码用途
   */
  async checkEmailAndCode(
    email: string,
    password: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<string> {
    // 检查邮箱是否存在
    const existingUser = await this.userService.findOneByEmail(email);

    // 邮箱不存在则抛出冲突异常
    if (!existingUser) throw new BadRequestException('用户不存在');

    // 校验验证码
    await this.verificationService.verifyAndConsume(email, purpose, code);

    // 对密码进行哈希处理
    return await this.hashPassword(password);
  }

  /**
   * 修改密码
   * @param email 邮箱
   * @param newPassword 新密码
   * @param code 验证码
   * @param purpose 验证码用途
   */
  async changePassword(
    email: string,
    newPassword: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<boolean> {
    const passwordHash = await this.checkEmailAndCode(
      email,
      newPassword,
      code,
      purpose,
    );
    try {
      // 修改密码
      await this.userService.updatePassword(email, passwordHash);
    } catch {
      throw new InternalServerErrorException('修改密码失败');
    }
    return true;
  }
}
