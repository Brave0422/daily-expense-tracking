/**
 * @author Brave
 * @date 2026-10-10T20:51:49+08:00
 * @description 十进制金额的精确比较与展示，不使用浮点数计算金额。
 */

const FILTER_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/

/** 检查可选金额筛选，空值表示不限制；格式与后端 DECIMAL(15,2) 约束一致。 */
export function isValidFilterAmount(value: string): boolean {
  return value === '' || FILTER_AMOUNT_PATTERN.test(value)
}

/** 将合法十进制元金额转为 BigInt 分，仅用于精确比较或判断零值。 */
function toCents(amount: string): bigint {
  const [integer = '0', fraction = ''] = amount.split('.')
  const sign = integer.startsWith('-') ? -1n : 1n
  return sign * (BigInt(integer.replace(/^[+-]/, '')) * 100n + BigInt(fraction.padEnd(2, '0')))
}

/** 比较两个合法非负金额，true 表示最小金额超过最大金额。 */
export function exceedsMaximumAmount(minAmount: string, maxAmount: string): boolean {
  return toCents(minAmount) > toCents(maxAmount)
}

/** 判断后端金额是否为零，不受小数位数或负零影响。 */
export function isZeroAmount(amount: string): boolean {
  return toCents(amount) === 0n
}

/** 格式化后端元金额为带千分位的两位小数字符串，不附加人民币符号。 */
export function formatAmount(amount: string): string {
  const [integer = '0', fraction = ''] = amount.split('.')
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}

/** 展示后端结余；正负值带符号，零值使用中性文案。 */
export function formatBalance(amount: string): string {
  if (isZeroAmount(amount)) return '0.00'
  const sign = amount.startsWith('-') ? '-' : '+'
  return `${sign} ¥ ${formatAmount(amount.replace(/^[+-]/, ''))}`
}
