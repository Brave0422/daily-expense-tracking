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
  /**
   * 初始化 VerificationCodesController 的依赖。
   *
   * @param verificationCodesService 处理验证码发送、核验和核销的服务
   */
  constructor(
    private readonly verificationCodesService: VerificationCodesService,
  ) {}

  /**
   * 发送验证码
   *
   * @param body 包含验证码用途及可选邮箱的发送请求
   * @param userId 当前登录用户id；注册和重置密码场景可以不传
   * @returns 验证码生成、保存并发送后异步结束，无响应数据
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
