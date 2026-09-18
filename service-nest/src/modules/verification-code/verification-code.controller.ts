/**
 * @author Brave
 * @date 2026-09-10 10:58:56
 * @description 验证码模块控制层
 */

import { Body, Controller, Post, Req } from '@nestjs/common';
import { VerificationCodeService } from './verification-code.service';
import { ResonpseMsg } from 'src/common/decorators/response-message.decorator';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Controller('verificationCode')
export class VerificationCodeController {
  constructor(private readonly verificationService: VerificationCodeService) {}

  /**
   * 发送验证码
   * @param body 发送验证码dto
   * @param request 已认证修改的请求
   */
  @Post('sendCode')
  @ResonpseMsg('验证码已发送')
  async sendCode(
    @Body() body: SendVerificationCodeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const { email, purpose } = body;

    // 获取守卫中添加的用户id
    const userId = request.user?.uid;

    await this.verificationService.sendCode(email, purpose, userId);
  }
}
