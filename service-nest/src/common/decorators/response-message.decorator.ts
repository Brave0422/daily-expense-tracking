/**
 * @author Brave
 * @date 2026-9-3 15:04:56
 * @description 自定义响应信息的元数据装饰器
 */

import { Reflector } from '@nestjs/core';

/**
 * 为控制器或接口设置统一成功响应中的提示消息。
 *
 * @param opts 需要展示的成功消息；未设置时由响应拦截器使用默认消息
 * @returns 写入响应消息元数据的类或方法装饰器
 */
export const ResponseMsg = Reflector.createDecorator<string>();
