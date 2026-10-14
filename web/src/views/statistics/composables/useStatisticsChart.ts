/**
 * @author Brave
 * @date 2026-10-14T14:17:47+08:00
 * @description 统计图表实例的初始化、完整配置替换、尺寸适配、图例联动及卸载释放。
 */
import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue'
import type { ECharts } from 'echarts/core'
import { createStatisticsChart, type StatisticsChartOption } from '../statistics-chart'

/**
 * 维护单个图表组件的ECharts生命周期，不跨板块共享实例或配置。
 * @param container 图表容器引用
 * @param option 当前成功响应生成的完整配置
 * @returns 图例显示和取消高亮的方法，实例在卸载时自动销毁
 */
export function useStatisticsChart(
  container: Ref<HTMLElement | null>,
  option: ComputedRef<StatisticsChartOption>,
) {
  let chart: ECharts | null = null
  let resizeObserver: ResizeObserver | null = null

  /** @returns 无返回值，隐藏旧Tooltip并完整替换配置，避免残留旧分类或周期 */
  function updateChart(): void {
    if (!chart) return
    chart.dispatchAction({ type: 'hideTip' })
    chart.setOption(option.value, { notMerge: true })
  }
  /** @returns 无返回值，在容器有尺寸时初始化或适配，不为暂时隐藏的区域创建零尺寸图表 */
  function resizeChart(): void {
    const element = container.value
    if (!element || element.clientWidth <= 0 || element.clientHeight <= 0) return
    if (!chart) {
      chart = createStatisticsChart(element)
      updateChart()
    } else {
      // 尺寸变化后旧浮层位置已不再对应当前图表，先关闭再重新布局。
      chart.dispatchAction({ type: 'hideTip' })
      chart.resize()
    }
  }
  /**
   * 图例悬停或键盘聚焦时联动同一响应顺序中的扇区。
   * @param dataIndex 当前分类在完整系列中的下标，不按名称查找同名分类
   * @returns 无返回值，清除先前高亮后显示本项的原生Tooltip
   */
  function showItemTooltip(dataIndex: number): void {
    chart?.dispatchAction({ type: 'downplay', seriesIndex: 0 })
    chart?.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex })
    chart?.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex })
  }
  /** @returns 无返回值，清除图例联动的高亮及图表浮层 */
  function clearItemTooltip(): void {
    chart?.dispatchAction({ type: 'downplay', seriesIndex: 0 })
    chart?.dispatchAction({ type: 'hideTip' })
  }
  onMounted(() => {
    resizeChart()
    // 卡片本身高度变化不一定触发窗口resize，优先观察实际图表容器。
    if (typeof ResizeObserver !== 'undefined' && container.value) {
      resizeObserver = new ResizeObserver(resizeChart)
      resizeObserver.observe(container.value)
    } else {
      window.addEventListener('resize', resizeChart)
    }
  })
  watch(option, updateChart, { flush: 'post' })
  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('resize', resizeChart)
    chart?.dispose()
    chart = null
  })
  return { showItemTooltip, clearItemTooltip }
}
