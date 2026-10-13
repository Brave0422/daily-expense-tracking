import { Reflector } from '@nestjs/core';

/**
 * @author Brave
 * @date 2026-09-17 11:45:06
 * @description 公共接口装饰器。公共接口可以不用走jwt鉴权
 */
type IS_PUBLIC_KEY = 'isPublic';
/**
 * 标记允许跳过 JWT 鉴权的控制器或接口。
 *
 * @param opts 可选公共接口标记；直接调用 Public() 即可使用默认标记
 * @returns 写入公共接口元数据的类或方法装饰器
 */
export const Public = Reflector.createDecorator<IS_PUBLIC_KEY>();
