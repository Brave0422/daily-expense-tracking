/**
 * @author Brave
 * @date 2026-9-10 17:11:02
 * @description 认证模块
 */

import { Module } from '@nestjs/common';
// 导入用户模块
import { UserModule } from '../users/users.module';
import { VerificationCodeModule } from '../verification-code/verification-code.module';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthTokenService } from './services/auth-token.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSessionsEntity } from './entities/authSessions.entity';

@Module({
  //在当前模块里注册相关模块
  imports: [
    // User模块
    UserModule,
    // 验证码模块
    VerificationCodeModule,
    // 注册authService实体
    TypeOrmModule.forFeature([AuthSessionsEntity]),
    // JWT模块
    JwtModule.registerAsync({
      inject: [ConfigService],

      // 工厂函数配置JWT
      useFactory: (configService: ConfigService) => ({
        // 签名配置
        signOptions: {
          // 签名算法
          algorithm: 'HS256',
          // 签发者
          issuer: configService.getOrThrow<string>('JWT_ISSUER'),
        },
        // 验证配置
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: configService.getOrThrow<string>('JWT_ISSUER'),
        },
      }),
    }),
  ],

  // 注册本模块的控制器
  controllers: [AuthController],

  // 注册本模块的服务提供者
  providers: [AuthService, AuthTokenService],
  exports: [AuthService, AuthTokenService],
})
export class AuthModule {}
