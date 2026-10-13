import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  /**
   * 初始化 AppController 的依赖。
   *
   * @param appService 提供默认欢迎文本的应用服务
   */
  constructor(private readonly appService: AppService) {}

  /**
   * 获取服务的默认欢迎文本。
   *
   * @returns 默认欢迎文本
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
