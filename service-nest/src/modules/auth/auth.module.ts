/**
 * @author Brave
 * @description 认证模块
 */

import { Module } from '@nestjs/common';
// 导入用户模块
import { UserModule } from '../users/users.module';
import { VerificationCodeModule } from '../verification-code/verification-code.module';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';

@Module({
  //在当前模块里注册 User用户实体仓库，验证码模块
  imports: [UserModule, VerificationCodeModule],

  // 注册本模块的控制器
  controllers: [AuthController],

  // 注册本模块的服务提供者
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
