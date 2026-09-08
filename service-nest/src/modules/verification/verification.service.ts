/**
 * @author Brave
 * @date 2026-09-08 15:53:22
 * @description 验证码模块服务层
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
// 验证码用途
type VerificationPurpose =
  'register' | 'change_password' | 'delete_account' | 'forgot_password';
@Injectable()
export class VerificationCodeService {
  constructor(private readonly configService: ConfigService) {}

  // 生成验证码 1 已完成
  // 哈希验证码 2 已完成
  // 校验验证码 3
  // 判断是否过期 4
  // 判断是否相等 5
  // 发送验证码
  // 判断是否发送频繁 6
  // 自动核销上次未使用的验证码 7

  /**
   * 生成6位数字验证码
   * @returns 6位随机数字字符串
   */
  private generateVerificationCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /**
   * 对验证码进行SHA256哈希
   * @param code 验证码
   * @param email 邮箱
   * @param purpose 验证码用途
   * @returns 哈希后的验证码字符串
   */
  private hashCode(code: string, email: string, purpose: string): string {
    const secret = this.configService.getOrThrow<string>(
      'VERIFICATION_CODE_SECRET',
    );
    return createHmac('sha256', secret)
      .update(`${email}:${purpose}:${code}`)
      .digest('hex');
  }

  /**
   * 安全比较验证码
   * @param storeHash 已经发送的验证码
   * @param email 邮箱
   * @param purpose 验证码用途
   * @param submittedCode 用户输入的验证码
   * @returns 验证结果
   */
  private compareCode(
    storeHash: string,
    email: string,
    purpose: VerificationPurpose,
    submittedCode: string,
  ): boolean {
    return true;
  }

  /**
   * 检查发送频率
   * @param email 邮箱
   * @param purpose 验证码用途
   */
  private ensureCanSend(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<void> {}

  /**
   * 使之前未使用的验证码失效
   * @param email 邮箱
   * @param purpose 验证码用途
   */
  private invalidatePreviousCodes(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<void> {}

  /**
   * 生成、保存并发送验证码
   * @param email 邮箱
   * @param purpose 验证码用途
   * @param userId 用户id
   */
  async sendCode(
    email: string,
    purpose: VerificationPurpose,
    userId?: number,
  ): Promise<void> {}

  /**
   * 校验并核销验证码
   * @param email 邮箱
   * @param purpose 验证码用途
   * @param code 验证码
   */
  async verifyAndConsume(
    email: string,
    purpose: VerificationPurpose,
    code: string,
  ): Promise<void> {}
}
