import { Reflector } from '@nestjs/core';

/**
 * @author Brave
 * @date 2026-09-17 11:45:06
 * @description 公共接口装饰器。公共接口可以不用走jwt鉴权
 */
type IS_PUBLIC_KEY = 'isPublic';
export const Public = Reflector.createDecorator<IS_PUBLIC_KEY>();
