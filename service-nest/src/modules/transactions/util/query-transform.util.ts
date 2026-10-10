/**
 * @author Brave
 * @date 2026-10-09 15:17:56
 * @description 流水模块工具函数
 */

// 去除首尾空格；清空输入后视为不使用该筛选条件。
export function trimOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const text = value.trim();
  return text === '' ? undefined : text;
}

// 将单个或多个查询参数转换为数字数组，并去重。
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
