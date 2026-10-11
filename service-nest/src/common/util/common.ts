/**
 * @author Brave
 * @date 2026-10-10 19:33:32
 * @description 通用工具函数
 */

/**
 * 将数据库返回的日期统一转换成 YYYY-MM-DD。
 *
 * MySQL 的 DATE 字段有时返回字符串，有时会被驱动转换成 Date，
 * 所以这里同时处理两种情况。
 */
export function toDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
