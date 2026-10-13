/**
 * @author Brave
 * @date 2026-10-09 15:17:56
 * @description 流水模块工具函数
 */

/**
 * 去除可选筛选文本的首尾空格，清空输入后视为不筛选。
 *
 * @param value 查询参数中的原始文本值
 * @returns 去除首尾空格后的字符串；空文本返回 undefined，非字符串原样返回
 */
export function trimOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const text = value.trim();
  return text === '' ? undefined : text;
}

/**
 * 将单个或多个查询id转换为数组并去重，保留错误类型供 DTO 校验。
 *
 * @param value 查询参数中的单个id、id数组或空值
 * @returns 去重后的数组，纯数字字符串转换为数字；null 和 undefined 原样返回
 */
export function toIdArray(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  const values: unknown[] = Array.isArray(value) ? value : [value];

  const ids = values.map((item) => {
    // 非数字字符串保留原值，让后面的校验拒绝它。
    if (typeof item === 'string' && /^\d+$/.test(item)) {
      return Number(item);
    }

    return item;
  });

  return [...new Set(ids)];
}
