/**
 * @author Brave
 * @date 2026-9-3 17:18:35
 * @description 日志拦截器
 */

import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 避免以后使用 WebSocket 等上下文时发生错误
    if (context.getType() !== 'http') {
      return next.handle();
    }

    // 取得 HTTP 环境的参数访问器
    const httpContext = context.switchToHttp();

    // 获取请求内容
    const request = httpContext.getRequest();

    // 获取响应内容
    const response = httpContext.getResponse();

    // 获取当前时间
    const startedAt = Date.now();

    // 获取请求方法
    const method = request.method();
    // 获取请求路径
    const path = request.originalUrl ?? request.url;
    // 获取用户id
    const userId = request.user?.id;
    // 获取请求id
    const requestId = request.requestId;

    return next.handle().pipe(
      tap({
        // 常规日志
        next: () => {
          // 计算耗时
          const durationMs = Date.now() - startedAt;
          // 输出日志
          this.logger.log({
            event: '请求完成',
            method,
            path,
            statusCode: response.statusCode,
            durationMs,
            requestId,
            userId,
          });
        },

        // 错误日志
        error: (error: unknown) => {
          // 计算耗时
          const durationMs = Date.now() - startedAt;
          // 设置状态码
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          // 输出日志
          this.logger.error({
            event: '请求失败',
            method,
            path,
            statusCode,
            durationMs,
            requestId,
            userId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
        },
      }),
    );
  }
}
