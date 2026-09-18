/**
 * @author Brave
 * @date 2026-9-2 17:33:26
 * @description 用户模块服务层
 */

import {
  UnauthorizedException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { compare } from 'bcrypt';
import { UserService } from '../../users/users.service';
import { VerificationCodeService } from '../../verification-code/verification-code.service';
import { VerificationPurpose } from '../../verification-code/enums/verification-purpose-enum';
import { AuthTokenService } from './auth-token.service';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthSessionsEntity } from '../entities/auth-sessions.entity';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { PasswordService } from './password.service';

export interface dualToken {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    // 注入用户服务
    private readonly userService: UserService,
    // 注入验证码服务
    private readonly verificationService: VerificationCodeService,
    private readonly authTokenService: AuthTokenService,
    @InjectRepository(AuthSessionsEntity)
    private readonly authSessionRepo: Repository<AuthSessionsEntity>,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * 用户注册
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
    const existingUser = await this.userService.findOneByEmail(email);

    // 如果邮箱已存在则抛出冲突异常
    if (existingUser) throw new ConflictException('该邮箱已被注册');

    // 校验验证码
    await this.verificationService.verifyAndConsume(
      email,
      VerificationPurpose.REGISTER,
      code,
    );

    // 哈希密码
    const passwordHash = await this.passwordService.hashPassword(password);

    try {
      // 创建用户实体
      const user = this.userService.create(email, passwordHash);

      // 保存用户
      await this.userService.save(user);

      return true;
    } catch {
      throw new InternalServerErrorException('注册失败');
    }
  }

  /**
   * 用户登录
   * @param email 邮箱
   * @param password 密码
   * @returns 双token
   */
  async login(email: string, password: string): Promise<dualToken> {
    // 根据邮箱查找对应用户
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('用户名或密码错误');

    // 匹配密码
    const matched = await this.passwordService.comparePassword(
      password,
      user.passwordHash,
    );

    if (!matched) throw new UnauthorizedException('用户名或密码错误');

    // 生成sessionId
    const sessionId = randomUUID();

    // 匹配成功，生成token返回给客户端，登录成功
    const [accessToken, refreshToken] = await Promise.all([
      this.authTokenService.generateAccessToken(user.id, sessionId),
      this.authTokenService.generateRefreshToken(user.id, sessionId),
    ]);

    // token获取成功则存入数据库
    await this.authTokenService.saveToken(user.id, sessionId, refreshToken);

    return { accessToken, refreshToken };
  }

  /**
   * 刷新token
   * @param refreshToken
   * @returns 双token
   */
  async refresh(refreshToken: string): Promise<dualToken> {
    // 1.先验证token
    const payload =
      await this.authTokenService.verifyRefreshToken(refreshToken);
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId)) {
      throw new UnauthorizedException('登录状态已失效');
    }

    // 2.查询数据库中的登录会话
    const session = await this.authSessionRepo.findOneBy({
      sid: payload.sid,
      revokedTime: IsNull(),
      // 只查询有效期内的
      expiresTime: MoreThan(new Date(Date.now())),
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('登录状态已失效');
    }

    // 3.与数据库存储的token进行比较
    const matched = await compare(refreshToken, session.refreshTokenHash);

    if (!matched) {
      throw new UnauthorizedException('登录状态已失效');
    }

    // 4.签发新的token
    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.authTokenService.generateAccessToken(userId, session.sid),
      // refreshToken是在原来的那条token上刷新哈希值和持续时间，不是新增一条数据
      this.authTokenService.generateRefreshToken(userId, session.sid),
    ]);

    // 5.更新旧的refresh token
    await this.authTokenService.updateToken(session.sid, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * 退出登录
   * @param userId 用户id
   * @param sid sessionId
   */
  async logout(userId: number, sid: string): Promise<void> {
    // 销毁对应的session
    await this.authSessionRepo.update(
      {
        userId,
        sid,
        revokedTime: IsNull(),
      },
      {
        revokedTime: new Date(),
      },
    );
  }
}
