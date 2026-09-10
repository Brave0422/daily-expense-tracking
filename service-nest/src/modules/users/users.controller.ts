/**
 * @author Brave
 * @date 2026-9-2 17:35:30
 * @description 用户模块控制层
 */

import { Body, Controller, Post } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UserService } from './users.service';
import { ResonpseMsg } from 'src/common/decorators/response-message.decorator';

@Controller('user')
export class UserController {
  // 注入用户服务
  constructor(private readonly userService: UserService) {}

  /**
   * 注册用户
   * @param body 注册用户dto
   * @returns
   */
  @Post('register')
  @ResonpseMsg('注册成功')
  async register(
    // 从请求体中提取并验证注册DTO
    @Body() body: RegisterDto,
  ) {
    const { email, password, code } = body;
    // 调用用户服务执行注册逻辑
    const result = await this.userService.register(email, password, code);

    return result;
  }
}
