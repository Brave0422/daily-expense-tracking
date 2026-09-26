/**
 * @author Brave
 * @date 2026-9-3 14:51:39
 * @description 响应拦截器
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ResponseMsg } from '../decorators/response-message.decorator';
import { ApiResponseDto } from '../dto/api-response.dto';
import type { Response } from 'express';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T>
> {
  // 注入Reflector
  constructor(private readonly reflector: Reflector) {}

  /**
   * 拦截方法
   * @param context - 执行上下文，包含请求和响应信息
   * @param next - 调用处理器，用于调用下一个处理程序
   * @returns 包装后的Observable响应
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    // 获取ResponseMsg装饰器的元数据
    const message = this.reflector.getAllAndOverride<string>(ResponseMsg, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 获取响应体
    const response = context.switchToHttp().getResponse<Response>();

    // 处理响应数据
    return next.handle().pipe(
      map((data) => {
        // 将 Nest 给 POST 请求默认设置的 201 强制覆盖成 200。
        response.status(HttpStatus.OK);
        // 修改响应msg
        return ApiResponseDto.success(data, message ?? '操作成功');
      }),
    );
  }
}
