/**
 * @author Brave
 * @date 2026-9-2 17:35:30
 * @description 用户模块控制层
 */

import { Body, Controller, Post } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UserService } from './users.service';
import { ResonpseMsg } from 'src/common/decorators/response-message.decorator';

@Controller('users')
@ResonpseMsg('注册成功')
export class UserController {
  // 注入用户服务
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(
    // 从请求体中提取并验证注册DTO
    @Body() body: RegisterDto,
  ) {
    // 调用用户服务执行注册逻辑
    const result = await this.userService.register(body.email, body.password);

    return result;
  }
}
