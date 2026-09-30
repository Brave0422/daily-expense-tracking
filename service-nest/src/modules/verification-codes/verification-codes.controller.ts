/**
 * @author Brave
 * @date 2026-09-10 10:58:56
 * @description 验证码模块控制层
 */

import { Body, Controller, Post } from '@nestjs/common';
import { VerificationCodesService } from './verification-codes.service';
import { ResponseMsg } from 'src/common/decorators/response-message.decorator';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { OptionalCurrentUserId } from '../auth/decorators/current-user.decorator';

@Controller('verification-codes')
export class VerificationCodesController {
  constructor(
    private readonly verificationCodesService: VerificationCodesService,
  ) {}

  /**
   * 发送验证码
   * @param body 发送验证码dto
   * @param request 已认证修改的请求
   */
  @Post('send')
  @ResponseMsg('验证码已发送')
  async sendCode(
    @Body() body: SendVerificationCodeDto,
    @OptionalCurrentUserId() userId?: number,
  ): Promise<void> {
    const { email, purpose } = body;

    await this.verificationCodesService.sendCode(email, purpose, userId);
  }
}
