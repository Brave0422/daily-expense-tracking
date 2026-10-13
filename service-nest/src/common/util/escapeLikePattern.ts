/**
 * @author Brave
 * @date 2026-09-27 20:49:48
 * @description 工具函数
 */

export const LIKE_ESCAPE_CHARACTER = '!';

/**
 * 将用户输入转换为 SQL LIKE 中的普通文本，避免扩大搜索范围。
 *
 * @param value 需要进行包含搜索的原始文本
 * @returns 已转义 LIKE 通配符及转义字符的文本，需配合对应 ESCAPE 子句使用
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, (character) => {
    return `${LIKE_ESCAPE_CHARACTER}${character}`;
  });
}
