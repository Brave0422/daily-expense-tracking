import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * 生成服务的默认欢迎文本。
   *
   * @returns 默认欢迎文本
   */
  getHello(): string {
    return 'Hello World!';
  }
}
