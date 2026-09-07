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
  catch(exception: HttpException, host: ArgumentsHost) {
    // 从 HTTP 环境的参数访问器获取响应内容
    const response = host.switchToHttp().getResponse<Response>();
    console.log('response：', response);

    const body = exception.getResponse();
    console.log('body', body);

  }
}
