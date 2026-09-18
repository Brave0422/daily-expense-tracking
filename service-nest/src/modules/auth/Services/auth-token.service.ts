/**
 * @author Brave
 * @date 2026-09-11 14:40:25
 * @description 处理token相关的逻辑
 */

import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthSessionsEntity } from '../entities/auth-sessions.entity';
import { Repository } from 'typeorm';
import { hash } from 'bcrypt';

export interface AccessTokenPayload {
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
// 获取jwt有效期类型
type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthTokenService {
  constructor(
    // 注入JwtService
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(AuthSessionsEntity)
    private readonly authSessionRepo: Repository<AuthSessionsEntity>,
  ) {}

  /**
   * 生成access token
   * @param userId 用户id
   * @returns access token
   */
  async generateAccessToken(userId: number): Promise<string> {
    const token = await this.jwtService.signAsync(
      {
        sub: String(userId),
        tokenType: 'access',
      },
      {
        // 配置密钥
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // 有效期
        expiresIn: this.configService.getOrThrow<JwtExpiresIn>(
          'JWT_ACCESS_EXPIRES_IN',
        ),
        // 预期接收者
        audience: 'daily-expense-api',
      },
    );
    return token;
  }
  /**
   * 生成refresh token
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
        sub: String(userId),
        sid: sessionId,
        tokenType: 'refresh',
      },
      {
        // 配置密钥
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        // 有效期
        expiresIn: this.configService.getOrThrow<JwtExpiresIn>(
          'JWT_REFRESH_EXPIRES_IN',
        ),

        // 预期接收者
        audience: 'daily-expense-refresh',
      },
    );

    return token;
  }

  /**
   * 构建token
   * @param token refresh token
   * @returns sessions部分值
   */
  private async buildTokenState(
    token: string,
  ): Promise<Pick<AuthSessionsEntity, 'refreshTokenHash' | 'expiresTime'>> {
    // 获取过期时间
    const payload = this.jwtService.decode<RefreshTokenPayload>(token);

    if (!payload || typeof payload.exp !== 'number') {
      throw new InternalServerErrorException('Refresh Token 缺少过期时间');
    }
    return {
      refreshTokenHash: await hash(token, 10),
      // JWT exp 是秒，Date 使用毫秒
      expiresTime: new Date(payload.exp * 1000),
    };
  }

  /**
   * 哈希token并保存至数据库
   * @param token refresh token
   * @param userId 用户id
   * @param sid 会话id
   */
  async saveToken(userId: number, sid: string, token: string): Promise<void> {
    const tokenState = await this.buildTokenState(token);
    // 存入数据库
    const saveToken = this.authSessionRepo.create({
      sid,
      userId,
      ...tokenState,
      revokedTime: null,
    });
    await this.authSessionRepo.save(saveToken);
  }

  /**
   * 更新数据库的refresh token
   * @param sid 会话id
   * @param token refresh token
   */
  async updateToken(sid: string, token: string): Promise<void> {
    const tokenState = await this.buildTokenState(token);

    // 更新数据
    const result = await this.authSessionRepo.update({ sid }, tokenState);

    if (result.affected !== 1) {
      throw new UnauthorizedException('登录状态已失效');
    }
  }

  /**
   * 验证身份token
   * @param token access token
   * @returns payload
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      // 验证token并获取payload
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          audience: 'daily-expense-api',
        },
      );
      if (payload.tokenType !== 'access' || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('登录状态已失效');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
  }

  /**
   * 验证时间token
   * @param token refresh token
   * @returns payload
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      // 验证token并获取payload
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          audience: 'daily-expense-refresh',
        },
      );

      if (
        payload.tokenType !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw new UnauthorizedException('登录状态已失效');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
  }
}
