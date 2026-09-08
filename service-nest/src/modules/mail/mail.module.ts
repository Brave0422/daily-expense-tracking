/**
 * @author Brave
 * @date 2026-9-8 10:24:57
 * @description 邮件模块
 */
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
})
export class MailModule {}
