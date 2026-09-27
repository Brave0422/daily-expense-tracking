/**
 * @author Brave
 * @date 2026-09-27 20:49:48
 * @description 工具函数
 */

export const LIKE_ESCAPE_CHARACTER = '!';

/**
 * 将用户输入转换为 SQL LIKE 中的普通文本。
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, (character) => {
    return `${LIKE_ESCAPE_CHARACTER}${character}`;
  });
}
