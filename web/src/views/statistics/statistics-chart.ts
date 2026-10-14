/**
 * @author Brave
 * @date 2026-10-14T14:17:47+08:00
 * @description 按需注册统计所需的ECharts模块并统一创建Canvas图表实例。
 */
import { init, use, type ComposeOption, type ECharts } from 'echarts/core'
import { BarChart, PieChart, type BarSeriesOption, type PieSeriesOption } from 'echarts/charts'
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
  type AriaComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 仅注册本页需要的图表、坐标系、提示与无障碍能力，不引入完整图表包。
use([BarChart, PieChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])

export type StatisticsChartOption = ComposeOption<
  | BarSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | AriaComponentOption
>

/**
 * 创建由当前组件负责销毁的ECharts实例。
 * @param container 已具备有效宽高的图表容器
 * @returns Canvas渲染实例，配置、尺寸适配和释放由调用方管理
 */
export function createStatisticsChart(container: HTMLElement): ECharts {
  return init(container, undefined, { renderer: 'canvas' })
}
