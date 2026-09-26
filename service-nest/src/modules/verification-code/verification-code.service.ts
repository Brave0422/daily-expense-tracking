/**
 * @author Brave
 * @date 2026-09-08 15:53:22
 * @description 验证码模块服务层
 */

import {
  HttpException,
  Injectable,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { IsNull, MoreThan, Repository, LessThan } from 'typeorm';
import { UserVerificationCodeEntity } from './entities/user-verification-code.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from '../mail/mail.service';
import { VerificationPurpose } from './enums/verification-purpose-enum';
import { UserService } from '../users/users.service';

// 登录态下发送验证码的类型
const AUTHENTICATED_PURPOSES: readonly VerificationPurpose[] = [
  VerificationPurpose.CHANGE_PASSWORD,
  VerificationPurpose.DELETE_ACCOUNT,
];

@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name);

  constructor(
    private readonly configService: ConfigService,
    // 注入验证码实体的仓库
    @InjectRepository(UserVerificationCodeEntity)
    private readonly verificationCodeRepo: Repository<UserVerificationCodeEntity>,
    private readonly mailService: MailService,
    private readonly userService: UserService,
  ) {}

  /**
   * 生成6位数字验证码
   * @returns 6位随机数字字符串
   */
  private generateVerificationCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /**
   * 获取开发环境固定验证码。
   * 只有明确处于 development 且配置了 DEV_VERIFICATION_CODE 时才会启用，
   * 生产环境即使误配该变量也会继续使用随机验证码和真实邮件。
   * @returns 六位开发验证码；未启用时返回 null
   */
  private getDevelopmentVerificationCode(): string | null {
    // 第一步：严格判断当前环境，避免测试验证码在非开发环境生效。
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';
    if (!isDevelopment) {
      return null;
    }

    // 第二步：读取显式配置；未配置时保持原有的真实邮件流程。
    const developmentCode = this.configService
      .get<string>('DEV_VERIFICATION_CODE')
      ?.trim();
    if (!developmentCode) {
      return null;
    }

    // 第三步：校验固定验证码格式，防止错误配置导致生成无法提交的验证码。
    if (!/^\d{6}$/.test(developmentCode)) {
      throw new InternalServerErrorException(
        'DEV_VERIFICATION_CODE 必须是六位数字',
      );
    }

    // 第四步：返回仅供本地开发使用的固定验证码。
    return developmentCode;
  }

  /**
   * 对验证码进行SHA256哈希
   * @param code 验证码
   * @param email 邮箱
   * @param purpose 验证码用途
   * @returns 哈希后的验证码字符串
   */
  private hashCode(
    code: string,
    email: string,
    purpose: VerificationPurpose,
  ): string {
    const secret = this.configService.getOrThrow<string>(
      'VERIFICATION_CODE_SECRET',
    );
    return createHmac('sha256', secret)
      .update(`${email}:${purpose}:${code}`)
      .digest('hex');
  }

  /**
   * 安全比较验证码
   * @param storedHash 已经发送并存储的验证码
   * @param submittedCodeHash 用户输入的验证码
   * @returns 验证结果
   */
  private compareCode(storedHash: string, submittedCodeHash: string): boolean {
    // 转为Buffer进行比较
    const storedBuffer = Buffer.from(storedHash, 'hex');

    const submittedBuffer = Buffer.from(submittedCodeHash, 'hex');

    // 比较两个验证码
    return (
      storedBuffer.length === submittedBuffer.length &&
      timingSafeEqual(storedBuffer, submittedBuffer)
    );
  }

  /**
   * 检查发送频率
   * @param email 邮箱
   * @param purpose 验证码用途
   */
  private async ensureCanSend(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<void> {
    // 获取验证码发送的冷却时间
    const cooldownMs =
      Number(this.configService.get<number>('MAIL_CODE_RESEND_SECONDS', 60)) *
      1000;
    // 查看最近一条同邮箱同用途的验证码的创建时间
    const latestCode = await this.verificationCodeRepo.findOne({
      where: {
        email,
        purpose,
      },
      order: { createdTime: 'DESC', id: 'DESC' },
    });

    // 1.处理验证码在冷却时间内频繁发送
    if (latestCode) {
      // 获取当前时间距验证码发送时间的间隔
      const passedMs = Date.now() - latestCode.createdTime.getTime();

      // 间隔小于冷却时间，提醒发送频繁
      if (passedMs < cooldownMs) {
        const retryAfterSeconds = Math.ceil((cooldownMs - passedMs) / 1000);
        throw new HttpException(
          {
            message: `验证码发送过于频繁，请${retryAfterSeconds}秒后重试`,
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2.处理验证码在一小时内频繁发送
    // 获取当前时间一小时前的时间
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 获取发送限制
    const maxNumber = Number(
      this.configService.get<number>('MAIL_CODE_SEND_MAX_NUMBER', 10),
    );

    // 获取这一个小时内发送给同一邮箱的验证码次数
    const hourlyCount = await this.verificationCodeRepo.count({
      where: {
        email,
        createdTime: MoreThan(oneHourAgo),
      },
    });

    // 发送次数超出设定的最大数量，提醒发送频繁
    if (hourlyCount >= maxNumber) {
      throw new HttpException(
        '验证码发送次数过多，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * 使之前未使用的验证码失效
   * @param email 邮箱
   * @param purpose 验证码用途
   * @param currentCodeId 此次操作需要排除的验证码id
   */
  private async invalidatePreviousCodes(
    email: string,
    purpose: VerificationPurpose,
    currentCodeId: number,
  ): Promise<void> {
    await this.verificationCodeRepo.update(
      {
        email,
        purpose,
        id: LessThan(currentCodeId),
        consumedTime: IsNull(),
        invalidatedTime: IsNull(),
      },
      {
        invalidatedTime: new Date(),
      },
    );
  }

  /**
   * 获取实际接收验证码的邮箱。
   * 修改密码和删除账户时只信任登录态对应的用户邮箱，不接收客户端传入值。
   * @param email 公共场景由客户端提交的邮箱
   * @param purpose 验证码用途
   * @param userId 登录用户 ID
   * @returns 规范化后的验证码接收邮箱
   */
  private async resolveRecipientEmail(
    email: string | undefined,
    purpose: VerificationPurpose,
    userId?: number,
  ): Promise<string> {
    // 登录态账户操作统一使用当前用户的注册邮箱。
    if (AUTHENTICATED_PURPOSES.includes(purpose)) {
      if (!userId) {
        throw new BadRequestException('缺少userId');
      }

      const user = await this.userService.findeOneById(userId);
      if (!user) {
        throw new BadRequestException('用户不存在');
      }
      return user.email;
    }

    if (!email) {
      throw new BadRequestException('邮箱不能为空');
    }
    return email;
  }

  /**
   * 生成、保存并发送验证码
   * @param email 公共场景由客户端提交的邮箱
   * @param purpose 验证码用途
   * @param userId 用户id，注册时没有userId
   */
  async sendCode(
    email: string | undefined,
    purpose: VerificationPurpose,
    userId?: number,
  ): Promise<void> {
    // 第一步：根据验证码用途确定实际接收邮箱。
    const recipientEmail = await this.resolveRecipientEmail(
      email,
      purpose,
      userId,
    );

    // 第二步：检查发送冷却时间和小时发送上限。
    await this.ensureCanSend(recipientEmail, purpose);

    // 第三步：开发环境优先使用显式配置的固定验证码，否则生成随机验证码。
    const developmentCode = this.getDevelopmentVerificationCode();
    const code = developmentCode ?? this.generateVerificationCode();

    // 第四步：只保存验证码哈希，不向数据库写入明文。
    const codeHash = this.hashCode(code, recipientEmail, purpose);

    // 第五步：读取验证码有效期。
    const expiresMinutes = Number(
      this.configService.get<number>('MAIL_CODE_EXPIRES_MINUTES', 5),
    );

    // 第六步：先保存验证码，避免真实邮件已发出但数据库保存失败。
    const saveCode = this.verificationCodeRepo.create({
      userId: userId ?? null,
      email: recipientEmail,
      purpose,
      codeHash,
      expiresTime: new Date(Date.now() + expiresMinutes * 60 * 1000),
      consumedTime: null,
      invalidatedTime: null,
    });
    await this.verificationCodeRepo.save(saveCode);

    // 第七步：固定验证码模式跳过 SMTP，并在服务端控制台提示当前测试信息。
    if (developmentCode) {
      this.logger.warn(
        `[开发验证码] 邮箱: ${recipientEmail}, 用途: ${purpose}, 验证码: ${developmentCode}`,
      );
    } else {
      // 第八步：非固定验证码模式通过 SMTP 发送真实邮件。
      try {
        await this.mailService.sendVerificationCode(
          recipientEmail,
          code,
          purpose,
        );
      } catch {
        // 第九步：邮件发送失败时废弃刚保存的验证码，避免其仍可被使用。
        await this.verificationCodeRepo.update(saveCode.id, {
          invalidatedTime: new Date(),
        });

        throw new InternalServerErrorException('邮件发送失败，请重新尝试');
      }
    }

    // 第十步：当前验证码已可用后，使同邮箱、同用途的旧验证码全部失效。
    await this.invalidatePreviousCodes(recipientEmail, purpose, saveCode.id);
  }

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
  ): Promise<void> {
    // 获取同一邮箱同一用途的最新未被使用的验证码哈希
    const storedCode = await this.verificationCodeRepo.findOne({
      where: {
        email,
        purpose,
        consumedTime: IsNull(),
        invalidatedTime: IsNull(),
      },
      order: { createdTime: 'DESC', id: 'DESC' },
    });

    if (!storedCode) {
      throw new BadRequestException(
        '未检测到已发送的验证码，请检查邮箱是否正确',
      );
    }
    if (storedCode.expiresTime.getTime() <= Date.now()) {
      // 已过期的验证码不再参与后续校验
      await this.verificationCodeRepo.update(
        {
          id: storedCode.id,
          consumedTime: IsNull(),
          invalidatedTime: IsNull(),
        },
        {
          invalidatedTime: new Date(),
        },
      );

      throw new BadRequestException('验证码已过期，请重新发送');
    }

    // 对传入的验证码进行哈希
    const submittedCodeHash = this.hashCode(code, email, purpose);

    // 安全比较两者
    const mached = this.compareCode(storedCode.codeHash, submittedCodeHash);

    if (!mached) {
      throw new BadRequestException('验证码错误');
    }

    // 核销验证码
    const updateResult = await this.verificationCodeRepo.update(
      {
        id: storedCode.id,
        consumedTime: IsNull(),
        invalidatedTime: IsNull(),
        expiresTime: MoreThan(new Date()),
      },
      {
        consumedTime: new Date(),
      },
    );

    if (updateResult.affected !== 1) {
      throw new BadRequestException('验证码已失效或已被使用，请重新发送');
    }
  }
}
