/**
 * @author Brave
 * @date 2026-10-10 16:58:44
 * @description 转换金额精度
 */

/**
 * 将最多两位小数的十进制金额字符串转换成“分”。
 *
 * 例如：
 * "12.34" -> 1234n
 * "12"    -> 1200n
 * "-1.50" -> -150n
 *
 * @param amount 已通过格式校验的金额字符串，最多两位小数，支持负数
 * @returns 以分为单位的 bigint，不使用浮点数计算
 */
export function amountToCents(amount: string): bigint {
  // 记录金额是否为负数
  const isNegative = amount.startsWith('-');

  // 去除负号，方便拆分整数部分和小数部分
  const unsignedAmount = isNegative ? amount.slice(1) : amount;

  // 将金额拆分成整数部分和小数部分
  const [integerPart, decimalPart = ''] = unsignedAmount.split('.');

  // 将小数部分补足两位，例如 "5" 变成 "50"
  const normalizedDecimalPart = decimalPart.padEnd(2, '0');

  // 将整数部分和小数部分合并成“分”
  const cents = BigInt(integerPart) * 100n + BigInt(normalizedDecimalPart);

  // 恢复金额的正负号
  return isNegative ? -cents : cents;
}

/**
 * 将“分”转换成固定两位小数的金额字符串。
 *
 * 例如：
 * 1234n  -> "12.34"
 * 1200n  -> "12.00"
 * -150n  -> "-1.50"
 *
 * @param cents 以分为单位的整数金额，支持负数
 * @returns 固定保留两位小数的十进制金额字符串
 */
export function centsToAmount(cents: bigint): string {
  // 记录金额是否为负数
  const isNegative = cents < 0n;

  // 使用绝对值拆分整数和小数部分
  const absoluteCents = isNegative ? -cents : cents;

  // 计算整数金额
  const integerPart = absoluteCents / 100n;

  // 计算不足一元的分，并补足两位
  const decimalPart = String(absoluteCents % 100n).padStart(2, '0');

  // 重新拼接为两位小数字符串
  return `${isNegative ? '-' : ''}${integerPart}.${decimalPart}`;
}

/**
 * 将数据库返回的金额统一格式化成两位小数字符串。
 *
 * undefined、null 和空字符串都按照 0 处理。
 *
 * @param amount 待格式化的金额字符串；undefined、null 和空字符串视为0
 * @returns 固定保留两位小数的金额字符串
 */
export function normalizeAmount(amount: string | null | undefined): string {
  return centsToAmount(amountToCents(amount || '0'));
}
