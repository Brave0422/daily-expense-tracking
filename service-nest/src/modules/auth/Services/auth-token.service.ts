/**
 * @author Brave
 * @date 2026-09-11 14:40:25
 * @description 处理token相关的逻辑
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthSessionsEntity } from '../entities/authSessions.entity';
import { Repository } from 'typeorm';
import { hash, compare } from 'bcrypt';

export interface AcessTokenPayload {
  sub: string;
  tokenType: 'access';
  iat?: number;
  exp?: number;
}
export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  tokenType: 'refresh';
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthTokenService {
  constructor(
    // 注入JwtService
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(AuthSessionsEntity)
    private readonly authServiceRepo: Repository<AuthSessionsEntity>,
  ) {}

  /**
   * 生成访问token
   * @param userId 用户id
   * @returns access token
   */
  async generateAccessToken(userId: number): Promise<string> {
    const token = await this.jwtService.signAsync(
      {
        sub: userId,
        tokenType: 'access',
      },
      {
        // 配置密钥
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // 有效期
        expiresIn: Number(
          this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
        ),
        // 预期接收者
        audience: 'daily-expense-api',
      },
    );
    return token;
  }
  /**
   * 生成时间token
   * @param userId 用户id
   * @param sessionId 会话id
   * @returns refresh token
   */
  async generateRefreshToken(
    userId: number,
    sessionId: string,
  ): Promise<string> {
    const token = await this.jwtService.signAsync(
      {
        sub: userId,
        sid: sessionId,
        tokenType: 'refresh',
      },
      {
        // 配置密钥
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        // 有效期
        expiresIn: Number(
          this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
        ),
        // 预期接收者
        audience: 'daily-expense-refresh',
      },
    );

    // token获取成功则存入数据库

    // 哈希token
    const refreshTokenHash = await hash(token, 10);
    // 获取过期天数
    const expiresDay = Number(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );
    // 存入数据库
    const saveToken = await this.authServiceRepo.create({
      sid: sessionId,
      userId,
      refreshTokenHash,
      expiresTime: new Date(Date.now() + expiresDay * 60 * 1000),
      revokedTime: null,
    });
    await this.authServiceRepo.save(saveToken);

    return token;
  }

  /**
   * 验证身份token
   * @param token access token
   * @returns payload
   */
  async verifyAccessToken(token: string): Promise<AcessTokenPayload> {
    // 验证token并获取payload
    const payload = await this.jwtService.verifyAsync(token, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      audience: 'daily-expense-api',
    });

    if (payload.tokenType !== 'access' || payload.sub !== 'string') {
      throw new UnauthorizedException('Acess Token 无效');
    }
    return payload;
  }

  /**
   * 验证时间token
   * @param token refresh token
   * @returns payload
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    // 验证token并获取payload
    const payload = await this.jwtService.verifyAsync(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      audience: 'daily-expense-refresh',
    });

    if (
      payload.tokenType !== 'refresh' ||
      payload.sub !== 'string' ||
      payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Refresh Token 无效');
    }
    return payload;
  }

}
