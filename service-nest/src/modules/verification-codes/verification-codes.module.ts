import { Module } from '@nestjs/common';
import { VerificationCodesController } from './verification-codes.controller';
import { VerificationCodesService } from './verification-codes.service';
import { MailModule } from '../mail/mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserVerificationCodeEntity } from './entities/user-verification-code.entity';
import { UsersModule } from '../users/users.module';

/**
 * @author Brave
 * @date 2026-09-10 10:56:04
 * @description 验证码模块
 */
@Module({
  // 注册验证码实体仓库、邮件模块
  imports: [
    TypeOrmModule.forFeature([UserVerificationCodeEntity]),
    MailModule,
    UsersModule,
  ],
  controllers: [VerificationCodesController],
  providers: [VerificationCodesService],

  // 导出验证码服务
  exports: [VerificationCodesService],
})
export class VerificationCodesModule {}
