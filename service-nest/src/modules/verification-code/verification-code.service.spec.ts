import { InternalServerErrorException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { UserService } from '../users/users.service';
import { UserVerificationCodeEntity } from './entities/user-verification-code.entity';
import { VerificationPurpose } from './enums/verification-purpose-enum';
import { VerificationCodeService } from './verification-code.service';

// Jest 当前以 CommonJS 运行，使用轻量替身避免加载 ESM 版 @nestjs/config。
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

// 同样替换仅用于依赖注入元数据的 TypeORM 装饰器。
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('VerificationCodeService', () => {
  const email = 'test@example.com';
  const secret = 'test-secret';
  let configValues: Record<string, string>;
  let verificationCodeRepo: jest.Mocked<
    Pick<
      Repository<UserVerificationCodeEntity>,
      'findOne' | 'count' | 'create' | 'save' | 'update'
    >
  >;
  let mailService: jest.Mocked<Pick<MailService, 'sendVerificationCode'>>;
  let userService: jest.Mocked<Pick<UserService, 'findeOneById'>>;
  let service: VerificationCodeService;

  beforeEach(() => {
    // 第一步：为每个用例准备可独立修改的环境配置。
    configValues = {
      NODE_ENV: 'development',
      DEV_VERIFICATION_CODE: '123456',
      VERIFICATION_CODE_SECRET: secret,
      MAIL_CODE_EXPIRES_MINUTES: '5',
      MAIL_CODE_RESEND_SECONDS: '60',
      MAIL_CODE_SEND_MAX_NUMBER: '10',
    };

    // 第二步：模拟配置服务，并保留默认值与必填配置的行为。
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key in configValues ? configValues[key] : defaultValue,
      ),
      getOrThrow: jest.fn((key: string) => {
        if (!(key in configValues)) {
          throw new Error(`Missing config: ${key}`);
        }
        return configValues[key];
      }),
    } as unknown as ConfigService;

    // 第三步：模拟验证码仓库，使测试只验证业务流程而不连接数据库。
    verificationCodeRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(
        (entity: Partial<UserVerificationCodeEntity>) =>
          ({ id: 1, ...entity }) as UserVerificationCodeEntity,
      ),
      save: jest.fn((entity: UserVerificationCodeEntity) =>
        Promise.resolve(entity),
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as typeof verificationCodeRepo;

    // 第四步：模拟邮件服务，检查固定验证码模式是否真正跳过 SMTP。
    mailService = {
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    };

    // 第五步：模拟登录用户查询，供修改密码等登录态验证码场景使用。
    userService = {
      findeOneById: jest.fn().mockResolvedValue({
        id: 7,
        email,
        passwordHash: 'password-hash',
        createdTime: new Date(),
        updateTime: new Date(),
      }),
    };

    // 第六步：使用以上依赖创建待测试服务。
    service = new VerificationCodeService(
      configService,
      verificationCodeRepo as unknown as Repository<UserVerificationCodeEntity>,
      mailService as unknown as MailService,
      userService as unknown as UserService,
    );

    // 第七步：屏蔽开发验证码日志，保持测试输出干净。
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // 每个用例结束后恢复被模拟的 Logger 方法。
    jest.restoreAllMocks();
  });

  it('在开发环境保存固定验证码并跳过 SMTP', async () => {
    // 第一步：调用注册用途的验证码发送流程。
    await service.sendCode(email, VerificationPurpose.REGISTER);

    // 第二步：计算固定验证码应保存的哈希值。
    const expectedHash = createHmac('sha256', secret)
      .update(`${email}:${VerificationPurpose.REGISTER}:123456`)
      .digest('hex');

    // 第三步：确认数据库保存的是固定验证码哈希而不是明文。
    expect(verificationCodeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        purpose: VerificationPurpose.REGISTER,
        codeHash: expectedHash,
      }),
    );

    // 第四步：确认开发模式没有调用真实邮件服务。
    expect(mailService.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('在生产环境忽略固定验证码配置并发送真实邮件', async () => {
    // 第一步：将运行环境切换为 production，保留误配的固定验证码。
    configValues.NODE_ENV = 'production';

    // 第二步：调用验证码发送流程。
    await service.sendCode(email, VerificationPurpose.RESET_PASSWORD);

    // 第三步：确认生产环境仍然调用真实邮件服务。
    expect(mailService.sendVerificationCode).toHaveBeenCalledWith(
      email,
      expect.stringMatching(/^\d{6}$/),
      VerificationPurpose.RESET_PASSWORD,
    );
  });

  it('修改密码时使用登录用户邮箱和固定验证码', async () => {
    // 第一步：不传客户端邮箱，只传入已登录用户 ID 和修改密码用途。
    await service.sendCode(undefined, VerificationPurpose.CHANGE_PASSWORD, 7);

    // 第二步：确认服务端根据登录用户 ID 查询其可信注册邮箱。
    expect(userService.findeOneById).toHaveBeenCalledWith(7);

    // 第三步：计算修改密码固定验证码应保存的哈希值。
    const expectedHash = createHmac('sha256', secret)
      .update(`${email}:${VerificationPurpose.CHANGE_PASSWORD}:123456`)
      .digest('hex');

    // 第四步：确认记录绑定用户、注册邮箱和正确的验证码用途。
    expect(verificationCodeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        email,
        purpose: VerificationPurpose.CHANGE_PASSWORD,
        codeHash: expectedHash,
      }),
    );

    // 第五步：确认修改密码场景同样不会调用真实邮件服务。
    expect(mailService.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('拒绝开发环境中的非六位固定验证码', async () => {
    // 第一步：写入不符合接口格式的固定验证码。
    configValues.DEV_VERIFICATION_CODE = '12345';

    // 第二步：确认配置错误会被明确拒绝，且不会保存或发送验证码。
    await expect(
      service.sendCode(email, VerificationPurpose.REGISTER),
    ).rejects.toThrow(InternalServerErrorException);
    expect(verificationCodeRepo.create).not.toHaveBeenCalled();
    expect(mailService.sendVerificationCode).not.toHaveBeenCalled();
  });
});
