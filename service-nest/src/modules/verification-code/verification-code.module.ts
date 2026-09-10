import { Module } from '@nestjs/common';
import { VerificationCodeController } from './verification-code.controller';
import { VerificationCodeService } from './verification-code.service';
import { MailModule } from '../mail/mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserVerificationCodeEntity } from './entities/user-verification-code.entity';

/**
 * @author Brave
 * @date 2026-09-10 10:56:04
 * @description 验证码模块
 */
@Module({
  // 注册验证码实体仓库、邮件模块
  imports: [TypeOrmModule.forFeature([UserVerificationCodeEntity]), MailModule],
  controllers: [VerificationCodeController],
  providers: [VerificationCodeService],

  // 导出验证码服务
  exports: [VerificationCodeService],
})
export class VerificationCodeModule {}
