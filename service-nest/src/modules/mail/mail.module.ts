/**
 * @author Brave
 * @date 2026-9-8 10:24:57
 * @description 邮件模块
 */
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  // 导出邮件服务给其他模块使用
  exports: [MailService],
})
export class MailModule {}
