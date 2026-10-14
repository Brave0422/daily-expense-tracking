/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 从原始查询读取统计 DTO，拒绝不属于接口的字段，不改变其他模块的校验规则。
 */
import {
  createParamDecorator,
  type ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * 读取原始查询供统计专用严格管道校验。
 * @param data 装饰器数据，统计查询不使用
 * @param context HTTP 执行上下文
 * @returns 尚未被全局白名单剔除未知字段的原始查询
 */
function readStatisticsQuery(
  data: unknown,
  context: ExecutionContext,
): Request['query'] {
  return context.switchToHttp().getRequest<Request>().query;
}
const RawStatisticsQuery = createParamDecorator(readStatisticsQuery);
/**
 * 创建统计专用参数装饰器，使用 DTO 校验并拒绝多余字段。
 * @returns 从查询解析 DTO 的装饰器，缺失、非法或额外参数返回 400
 */
export function StatisticsQuery(): ParameterDecorator {
  // 全局管道默认跳过自定义装饰器，保留原始字段；专用管道随后执行严格白名单。
  return RawStatisticsQuery(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
    }),
  );
}
