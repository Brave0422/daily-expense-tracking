/**
 * @author Brave
 * @date 2026-9-7 11:19:26
 * @description 统一异常过滤器
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * 读取并记录 HTTP 异常上下文，当前实现仅输出调试信息。
   *
   * @param exception 需要处理的 HTTP 异常
   * @param host 当前异常的参数宿主，用于取得 HTTP 响应
   * @returns 无返回值；当前实现没有写入异常响应
   */
  catch(exception: HttpException, host: ArgumentsHost) {
    // 从 HTTP 环境的参数访问器获取响应内容
    const response = host.switchToHttp().getResponse<Response>();
    console.log('response：', response);

    const body = exception.getResponse();
    console.log('body', body);
  }
}
