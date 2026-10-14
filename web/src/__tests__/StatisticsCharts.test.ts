/**
 * @author Brave
 * @date 2026-10-14T12:53:48+08:00
 * @description ECharts统计配置、图例联动、精确Tooltip、尺寸适配和实例清理测试。
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TooltipComponentOption } from 'echarts/components'
import type { CategoryStatisticsResult, TransactionTrendResult } from '@/api/statistics.types'
import type { StatisticsChartOption } from '@/views/statistics/statistics-chart'
const createChartMock = vi.hoisted(() => vi.fn())
vi.mock('@/views/statistics/statistics-chart', () => ({ createStatisticsChart: createChartMock }))
import StatisticsProportion from '@/views/statistics/components/StatisticsProportion.vue'
import StatisticsTrend from '@/views/statistics/components/StatisticsTrend.vue'
import {
  createCategoryProportionOption,
  createTransactionTrendOption,
} from '@/views/statistics/statistics-chart-options'
import { getCategoryChartColor } from '@/views/statistics/statistics-view.util'

const result: CategoryStatisticsResult = {
  period: '2026-10',
  periodType: 'month',
  type: 'expense',
  categoryLevel: 2,
  transactionCount: 3,
  totalAmount: '3.00',
  items: [
    {
      categoryId: 11,
      name: '早餐',
      parent: { categoryId: 1, name: '三餐' },
      iconKey: 'food',
      backgroundColor: '#22C55E',
      amount: '1.00',
      percentage: '33.33',
    },
    {
      categoryId: 12,
      name: '午餐',
      parent: { categoryId: 1, name: '三餐' },
      iconKey: 'food',
      backgroundColor: '#22C55E',
      amount: '2.00',
      percentage: '66.67',
    },
  ],
}
/**
 * 生成完整三十一个零值日期的月趋势。
 * @param overrides 需要覆盖的比较状态或周期
 * @returns 与接口契约一致的月趋势响应
 */
function createTrend(overrides: Partial<TransactionTrendResult> = {}): TransactionTrendResult {
  return {
    period: '2026-10',
    periodType: 'month',
    type: 'expense',
    transactionCount: 0,
    totalAmount: '0.00',
    previousPeriod: '2026-09',
    previousTotalAmount: '0.00',
    changeStatus: 'unchanged',
    changeRate: '0.00',
    series: Array.from({ length: 31 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      amount: '0.00',
    })),
    ...overrides,
  }
}
/**
 * 读取单个统计图表的Tooltip配置。
 * @param option 待检查的图表配置
 * @returns 非空、非数组的Tooltip配置
 */
function getTooltip(option: StatisticsChartOption): TooltipComponentOption {
  const tooltip = option.tooltip
  if (!tooltip || Array.isArray(tooltip)) throw new Error('缺少单个Tooltip配置')
  return tooltip
}
/**
 * 使用完整ECharts回调参数调用精确金额Formatter。
 * @param option 待检查的图表配置
 * @param dataIndex 当前分类或日期在系列中的下标
 * @param isAxis 是否模拟轴提示的数组参数
 * @returns 纯文本Formatter生成的节点
 */
function formatTooltip(
  option: StatisticsChartOption,
  dataIndex: number,
  isAxis = false,
): HTMLElement {
  const formatter = getTooltip(option).formatter
  if (typeof formatter !== 'function') throw new Error('缺少Tooltip Formatter')
  const params = {
    componentType: 'series',
    componentSubType: 'pie',
    componentIndex: 0,
    name: '显示项',
    dataIndex,
    data: 0,
    value: 0,
    percent: 99.99,
    $vars: [],
  }
  const content = formatter(isAxis ? [params] : params, 'test-ticket')
  if (!(content instanceof HTMLElement)) throw new Error('Tooltip未使用纯文本节点')
  return content
}
/** @returns 可记录图表配置、联动、尺寸变化和释放行为的实例替身 */
function createChartInstance() {
  return {
    setOption: vi.fn<(option: StatisticsChartOption, options: { notMerge: boolean }) => void>(),
    dispatchAction: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }
}
type ChartInstanceMock = ReturnType<typeof createChartInstance>
const instances: ChartInstanceMock[] = []
const wrappers: VueWrapper[] = []
const resizeCallbacks: (() => void)[] = []
const observers: TestResizeObserver[] = []
class TestResizeObserver implements ResizeObserver {
  observe = vi.fn<ResizeObserver['observe']>()
  unobserve = vi.fn<ResizeObserver['unobserve']>()
  disconnect = vi.fn<ResizeObserver['disconnect']>()
  /**
   * 保存尺寸事件，供测试主动触发真实生命周期方法。
   * @param callback 图表的尺寸适配回调
   * @returns 构造完成的监听替身
   */
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(() => callback([], this))
    observers.push(this)
  }
}
/** @returns 当前测试已创建的单个图表实例 */
function getChart(): ChartInstanceMock {
  const instance = instances[0]
  if (!instance) throw new Error('图表没有初始化')
  return instance
}
/** @returns 当前实例最后一次应用的完整配置 */
function getAppliedOption(): StatisticsChartOption {
  const option = getChart().setOption.mock.lastCall?.[0]
  if (!option) throw new Error('图表未应用配置')
  return option
}
describe('ECharts统计图表', () => {
  beforeEach(() => {
    instances.splice(0)
    observers.splice(0)
    resizeCallbacks.splice(0)
    createChartMock.mockReset().mockImplementation(() => {
      const instance = createChartInstance()
      instances.push(instance)
      return instance
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  it('环形系列按原始金额绘制，分类跨顺序保持ID和稳定颜色', async () => {
    const wrapper = mount(StatisticsProportion, { props: { result } })
    wrappers.push(wrapper)
    expect(getAppliedOption().series).toMatchObject([
      {
        type: 'pie',
        radius: ['68%', '92%'],
        data: [
          { id: '11', value: 1, itemStyle: { color: getCategoryChartColor(11) } },
          { id: '12', value: 2, itemStyle: { color: getCategoryChartColor(12) } },
        ],
      },
    ])
    expect(getCategoryChartColor(11)).not.toBe(getCategoryChartColor(12))
    expect(wrapper.text()).toContain('¥ 3.00')
    expect(wrapper.find('svg').exists()).toBe(false)
    await wrapper.setProps({
      result: { ...result, period: '2026-09', items: [...result.items].reverse() },
    })
    expect(getAppliedOption().series).toMatchObject([
      {
        data: [
          { id: '12', itemStyle: { color: getCategoryChartColor(12) } },
          { id: '11', itemStyle: { color: getCategoryChartColor(11) } },
        ],
      },
    ])
    expect(createChartMock).toHaveBeenCalledTimes(1)
  })
  it('图例悬停和键盘聚焦联动ECharts原生高亮和Tooltip', async () => {
    const wrapper = mount(StatisticsProportion, { props: { result } })
    wrappers.push(wrapper)
    await wrapper.find('.proportion-legend__item').trigger('mouseenter')
    expect(getChart().dispatchAction).toHaveBeenCalledWith({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: 0,
    })
    expect(getChart().dispatchAction).toHaveBeenCalledWith({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex: 0,
    })
    expect(formatTooltip(getAppliedOption(), 0).textContent).toBe('三餐 / 早餐 · ¥ 1.00 · 33.33%')
    expect(getTooltip(getAppliedOption()).appendTo).toBe('body')
    await wrapper.find('.proportion-legend__item').trigger('mouseleave')
    expect(getChart().dispatchAction).toHaveBeenCalledWith({ type: 'downplay', seriesIndex: 0 })
    expect(getChart().dispatchAction).toHaveBeenLastCalledWith({ type: 'hideTip' })
    await wrapper.findAll('.proportion-legend__item')[1]?.trigger('focus')
    expect(getChart().dispatchAction).toHaveBeenLastCalledWith({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex: 1,
    })
  })
  it('Tooltip保留超出安全整数的大金额最后一分，名称中的HTML作为纯文本', () => {
    const item = result.items[0]
    if (!item) throw new Error('缺少样本分类')
    const option = createCategoryProportionOption(
      {
        ...result,
        totalAmount: '90071992547409.91',
        items: [
          {
            ...item,
            name: '<img src=x onerror=alert(1)>',
            amount: '90071992547409.91',
            percentage: '100.00',
          },
        ],
      },
      null,
    )
    const content = formatTooltip(option, 0)
    expect(content.textContent).toBe(
      '三餐 / <img src=x onerror=alert(1)> · ¥ 90,071,992,547,409.91 · 100.00%',
    )
    expect(content.querySelector('img')).toBeNull()
  })
  it('分类减少后完整替换配置并关闭旧浮层，卸载释放实例和尺寸观察', async () => {
    const wrapper = mount(StatisticsProportion, { props: { result } })
    wrappers.push(wrapper)
    await wrapper.setProps({
      result: { ...result, items: result.items.slice(0, 1), totalAmount: '1.00' },
    })
    expect(getAppliedOption().series).toMatchObject([{ data: [{ id: '11' }] }])
    expect(getChart().setOption.mock.lastCall?.[1]).toEqual({ notMerge: true })
    expect(getChart().dispatchAction).toHaveBeenLastCalledWith({ type: 'hideTip' })
    resizeCallbacks[0]?.()
    expect(getChart().resize).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    wrappers.splice(0)
    expect(getChart().dispose).toHaveBeenCalledTimes(1)
    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1)
  })
  it('容器暂时没有尺寸时延迟初始化，后续尺寸可用时应用最新数据', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(0)
    const wrapper = mount(StatisticsProportion, { props: { result } })
    wrappers.push(wrapper)
    expect(createChartMock).not.toHaveBeenCalled()
    await wrapper.setProps({
      result: { ...result, items: result.items.slice(1), totalAmount: '2.00' },
    })
    width.mockReturnValue(400)
    resizeCallbacks[0]?.()
    expect(createChartMock).toHaveBeenCalledTimes(1)
    expect(getAppliedOption().series).toMatchObject([{ data: [{ id: '12' }] }])
  })
  it('零金额趋势保留全部日期和默认轴，下降100%不同时显示负号', () => {
    const wrapper = mount(StatisticsTrend, {
      props: {
        result: createTrend({
          previousTotalAmount: '100.00',
          changeStatus: 'decrease',
          changeRate: '-100.00',
        }),
      },
    })
    wrappers.push(wrapper)
    const option = getAppliedOption()
    expect(option.xAxis).toMatchObject({
      data: Array.from(
        { length: 31 },
        (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`,
      ),
    })
    expect(option.series).toMatchObject([
      {
        type: 'bar',
        data: Array.from({ length: 31 }, (_, index) => ({
          name: `2026-10-${String(index + 1).padStart(2, '0')}`,
          value: 0,
        })),
      },
    ])
    expect(option.yAxis).toMatchObject({ min: 0, max: 100 })
    expect(formatTooltip(option, 30, true).textContent).toBe('2026-10-31 · ¥ 0.00')
    expect(wrapper.text()).toContain('较上月 ↓ 100.00%')
    expect(wrapper.text()).not.toContain('-100.00%')
    expect(wrapper.find('.trend-comparison').classes()).toContain('trend-comparison--red')
  })
  it('年趋势保留十二个月，正金额轴由ECharts确定可读刻度', () => {
    const option = createTransactionTrendOption(
      createTrend({
        period: '2026',
        periodType: 'year',
        series: Array.from({ length: 12 }, (_, index) => ({
          date: `2026-${String(index + 1).padStart(2, '0')}`,
          amount: index === 0 ? '1200.00' : '0.00',
        })),
      }),
      null,
    )
    expect(option.xAxis).toMatchObject({
      data: Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`),
    })
    expect(option.yAxis).not.toHaveProperty('max')
    expect(formatTooltip(option, 0, true).textContent).toBe('2026-01 · ¥ 1,200.00')
  })
  it.each([
    ['expense', 'increase', '25.00', '较上月 ↑ 25.00%', 'green'],
    ['income', 'increase', '25.00', '较上月 ↑ 25.00%', 'red'],
    ['income', 'decrease', '-25.00', '较上月 ↓ 25.00%', 'green'],
    ['expense', 'new', null, '较上月新增', 'green'],
  ] as const)('%s %s 的比较信息独立于图表库', (type, changeStatus, changeRate, text, color) => {
    const wrapper = mount(StatisticsTrend, {
      props: { result: createTrend({ type, changeStatus, changeRate }) },
    })
    wrappers.push(wrapper)
    expect(wrapper.find('.trend-comparison').text()).toBe(text)
    expect(wrapper.find('.trend-comparison').classes()).toContain(`trend-comparison--${color}`)
  })
})
