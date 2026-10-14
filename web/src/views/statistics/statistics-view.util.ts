/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 统计周期显示、数据库边界校验、分类路径与独立于图标背景的稳定图表配色。
 */
import type { CategoryStatisticsItem, StatisticsPeriodType } from '@/api/statistics.types'
import { formatAmount } from '@/utils/money'

/**
 * @param period YYYY-MM 或 YYYY 周期
 * @returns 本地化年月文案
 */
export function formatStatisticsPeriod(period: string): string {
  const [year, month] = period.split('-')
  return month ? `${year}年${Number(month)}月` : `${year}年`
}
/**
 * 限定前端可选范围，与后端的 MySQL DATE 及上一比较周期边界一致。
 * @param period 待选择周期
 * @param periodType 月或年
 * @returns 格式及边界合法时为 true
 */
export function isValidStatisticsPeriod(period: string, periodType: StatisticsPeriodType): boolean {
  return periodType === 'month'
    ? period.length === 7 &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(period) &&
        period >= '1000-02' &&
        period <= '9999-11'
    : period.length === 4 && /^\d{4}$/.test(period) && period >= '1001' && period <= '9998'
}
/**
 * @param item 当前分类聚合项
 * @returns 可区分同名二级分类的完整父子路径
 */
export function getCategoryPath(item: CategoryStatisticsItem): string {
  return item.parent ? `${item.parent.name} / ${item.name}` : item.name
}
/**
 * @param item 当前分类聚合项
 * @returns 分类路径、完整元金额和后端百分比 Tooltip
 */
export function getCategoryTooltip(item: CategoryStatisticsItem): string {
  return `${getCategoryPath(item)} · ¥ ${formatAmount(item.amount)} · ${item.percentage}%`
}
/**
 * 使用 ID 的黄金角色相生成稳定配色，邻近二级分类也有可区分的颜色。
 * @param categoryId 分类唯一 ID，不依赖当次列表位置或图标背景
 * @returns 适合白色卡片且跨周期稳定的 HSL 扇区及图例颜色
 */
export function getCategoryChartColor(categoryId: number): string {
  const hue = (categoryId * 137.508) % 360
  // 逗号格式同时兼容浏览器CSS及ECharts Canvas的颜色解析器。
  return `hsl(${hue.toFixed(2)}, 64%, 47%)`
}
