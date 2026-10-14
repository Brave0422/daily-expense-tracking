/**
 * @author Brave
 * @date 2026-10-14T14:17:47+08:00
 * @description ECharts环形图与柱状图配置，保留精确金额文案、完整时间轴及稳定分类配色。
 */
import type { TooltipComponentOption } from 'echarts/components'
import type { CategoryStatisticsResult, TransactionTrendResult } from '@/api/statistics.types'
import { formatAmount } from '@/utils/money'
import { getCategoryChartColor, getCategoryPath, getCategoryTooltip } from './statistics-view.util'
import type { StatisticsChartOption } from './statistics-chart'

/**
 * 读取ECharts回调对应的分类或时间点位置，兼容单项与轴Tooltip。
 * @param params ECharts提供的单项或数组参数
 * @returns 合法数据下标；无法识别时为-1
 */
function getTooltipDataIndex(params: unknown): number {
  const item: unknown = Array.isArray(params) ? params[0] : params
  return typeof item === 'object' &&
    item !== null &&
    'dataIndex' in item &&
    typeof item.dataIndex === 'number'
    ? item.dataIndex
    : -1
}
/**
 * 以纯文本生成Tooltip节点，防止分类名称或父级路径被解析成HTML。
 * @param content 包含完整路径或日期及后端精确金额的文案
 * @returns 可交给ECharts展示的HTML元素
 */
function createTooltipContent(content: string): HTMLElement {
  const element = document.createElement('div')
  element.textContent = content
  return element
}
/**
 * 创建挂载到body且受视口限制的ECharts Tooltip。
 * @param container 图表容器，用于将局部位置转换到当前视口
 * @param formatter 使用原始金额字符串的纯文本内容构造方法
 * @returns HTML提示配置，滚动容器不裁切浮层且位置不超出屏幕
 */
function createStatisticsTooltip(
  container: HTMLElement | null,
  formatter: (params: unknown) => HTMLElement,
): TooltipComponentOption {
  return {
    renderMode: 'html',
    appendTo: 'body',
    hideDelay: 0,
    transitionDuration: 0,
    formatter,
    backgroundColor: '#292c32',
    borderWidth: 0,
    padding: [10, 12],
    textStyle: { color: '#ffffff', fontSize: 12, lineHeight: 20 },
    extraCssText:
      'max-width: min(260px, calc(100vw - 24px)); white-space: normal; overflow-wrap: anywhere; border-radius: 8px;',
    /**
     * 把图表局部Tooltip位置限制到可见视口，包括卡片横向滚动后的偏移。
     * @param point 图表局部触发坐标
     * @param _params 图表提示参数，此处不参与定位
     * @param _dom ECharts创建的提示元素，此处使用size中的测量结果
     * @param _rect 当前图形矩形，此处使用触发坐标
     * @param size ECharts测量的内容与图表尺寸
     * @returns 图表局部位置，转换到body后仍位于视口内
     */
    position(point, _params, _dom, _rect, size) {
      const box = container?.getBoundingClientRect()
      const left = box?.left ?? 0
      const top = box?.top ?? 0
      const width = size.contentSize[0] ?? 0
      const height = size.contentSize[1] ?? 0
      return [
        Math.max(8 - left, Math.min((point[0] ?? 0) + 12, window.innerWidth - left - width - 8)),
        Math.max(8 - top, Math.min((point[1] ?? 0) + 12, window.innerHeight - top - height - 8)),
      ]
    },
  }
}
/**
 * 用全部精确分类金额的绘图数值构造环形系列，百分比文案始终取后端响应。
 * @param result 当前成功的分类占比响应，不重新排序或合并分类
 * @param container 当前图表容器，限制Tooltip到可见视口
 * @returns 按分类ID稳定配色的完整ECharts配置
 */
export function createCategoryProportionOption(
  result: CategoryStatisticsResult,
  container: HTMLElement | null,
): StatisticsChartOption {
  /**
   * 使用分类ID对应的原始金额和后端占比，忽略图表内部舍入的percent。
   * @param params ECharts扇区提示参数
   * @returns 包含完整分类路径的纯文本节点
   */
  function formatCategoryTooltip(params: unknown): HTMLElement {
    const item = result.items[getTooltipDataIndex(params)]
    return createTooltipContent(item ? getCategoryTooltip(item) : '')
  }
  return {
    animation: false,
    aria: { enabled: true, description: result.items.map(getCategoryTooltip).join('；') },
    tooltip: {
      ...createStatisticsTooltip(container, formatCategoryTooltip),
      trigger: 'item',
    },
    series: [
      {
        id: 'category-proportion',
        type: 'pie',
        stillShowZeroSum: false,
        showEmptyCircle: false,
        radius: ['68%', '92%'],
        center: ['50%', '50%'],
        selectedMode: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: false, focus: 'self' },
        // value仅用于ECharts绘图权重，不用舍入后的percentage重建比例。
        data: result.items.map((item) => ({
          id: String(item.categoryId),
          name: getCategoryPath(item),
          value: Number(item.amount),
          itemStyle: { color: getCategoryChartColor(item.categoryId) },
        })),
      },
    ],
  }
}
/**
 * 将绘图轴刻度简写为可读单位，不参与业务金额计算。
 * @param value ECharts绘图刻度，单位元
 * @returns 普通数值或以万、亿为单位的轴文案
 */
function formatAxisAmount(value: number): string {
  if (value >= 100000000) return `${Number((value / 100000000).toPrecision(3))}亿`
  if (value >= 10000) return `${Number((value / 10000).toPrecision(3))}万`
  return String(Number(value.toPrecision(3)))
}
/**
 * 获取当前项目主题色，确保柱子沿用页面实际主题。
 * @param container 当前图表容器，为null时采用项目默认主题
 * @param variable CSS主题变量名称
 * @param fallback 未定义变量时使用的项目默认颜色
 * @returns 可用于ECharts Canvas绘图的具体颜色
 */
function getThemeColor(container: HTMLElement | null, variable: string, fallback: string): string {
  return container
    ? getComputedStyle(container).getPropertyValue(variable).trim() || fallback
    : fallback
}
/**
 * 构造完整自然周期柱状图，零金额位置保留，Tooltip使用原始精确金额。
 * @param result 当前成功的趋势响应，包括完整日期或月份序列
 * @param container 图表容器，用于主题色和Tooltip定位
 * @returns 由ECharts处理轴、网格线、刻度、高亮和提示的完整配置
 */
export function createTransactionTrendOption(
  result: TransactionTrendResult,
  container: HTMLElement | null,
): StatisticsChartOption {
  const hasPositiveAmount = result.series.some((point) => Number(point.amount) > 0)
  /**
   * 轴Tooltip使用发生日期和后端原始金额字符串，包括零值位置。
   * @param params ECharts轴提示的单项或数组参数
   * @returns 两位小数、千分位的完整人民币金额节点
   */
  function formatTrendTooltip(params: unknown): HTMLElement {
    const point = result.series[getTooltipDataIndex(params)]
    return createTooltipContent(point ? `${point.date} · ¥ ${formatAmount(point.amount)}` : '')
  }
  return {
    animation: false,
    aria: {
      enabled: true,
      description: result.series
        .map((point) => `${point.date}：¥ ${formatAmount(point.amount)}`)
        .join('；'),
    },
    // 使用6.1的轴标签边界布局，避免依赖旧containLabel兼容模块。
    grid: {
      top: 28,
      right: 12,
      bottom: 24,
      left: 0,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    tooltip: {
      ...createStatisticsTooltip(container, formatTrendTooltip),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'category',
      data: result.series.map((point) => point.date),
      axisLine: { lineStyle: { color: '#edf0f3' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#8b9099',
        fontSize: 10,
        hideOverlap: true,
        showMinLabel: true,
        showMaxLabel: true,
        interval: result.periodType === 'year' ? 0 : 'auto',
        /** @param date 完整日期或月份 @returns 本地化的日或月刻度，不改变数据轴 */
        formatter(date: string): string {
          return `${Number(date.slice(-2))}${result.periodType === 'month' ? '日' : '月'}`
        },
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      ...(hasPositiveAmount ? {} : { max: 100 }),
      splitNumber: 4,
      axisLabel: { color: '#8b9099', fontSize: 10, formatter: formatAxisAmount },
      splitLine: { lineStyle: { color: '#edf0f3' } },
    },
    series: [
      {
        id: 'transaction-trend',
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: {
          color: getThemeColor(container, '--color-primary', '#ffe639'),
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: { color: getThemeColor(container, '--color-primary-active', '#dec500') },
        },
        // 所有时间点均传给ECharts，包括零金额和当前周期内的未来位置。
        data: result.series.map((point) => ({ name: point.date, value: Number(point.amount) })),
      },
    ],
  }
}
