/**
 * @author Brave
 * @date 2026-9-3 15:04:56
 * @description 自定义响应信息的元数据装饰器
 */

import { Reflector } from '@nestjs/core';

// 返回元数据装饰器
export const ResonpseMsg = Reflector.createDecorator<string>();
