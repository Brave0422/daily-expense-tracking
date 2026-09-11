/**
 * @author Brave
 * @date 2026-09-11 14:40:25
 * @description 处理token相关的逻辑
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthTokenService {
  constructor(
    // 注入JwtService
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 创建token
   * @param userId 用户id
   * @param email 邮箱
   * @returns Jwt格式的token
   */
  async createToken(userId: number, email: string): Promise<string> {
    const token = await this.jwtService.signAsync({
      sub: userId,
      email,
    });
    return token;
  }
}
