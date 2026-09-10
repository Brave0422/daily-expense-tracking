/**
 * @author Brave
 * @date 2026-09-10 10:58:56
 * @description 验证码模块控制层
 */

import { Body, Controller, Post } from '@nestjs/common';
import { VerificationCodeService } from './verification-code.service';
import { ResonpseMsg } from 'src/common/decorators/response-message.decorator';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';

@Controller('verificationCode')
export class VerificationCodeController {
  constructor(private readonly verificationService: VerificationCodeService) {}

  /**
   * 发送验证码
   * @param body 发送验证码dto
   */
  @Post('sendCode')
  @ResonpseMsg('验证码已发送')
  async sendCode(@Body() body: SendVerificationCodeDto) {
    const { email, purpose } = body;
    await this.verificationService.sendCode(email, purpose);
  }
}
