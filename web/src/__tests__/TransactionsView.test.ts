/**
 * @author Brave
 * @date 2026-10-10T21:05:20+08:00
 * @description 账单页面交互测试，覆盖统计口径、空状态、分类联动、分组及禁用入口。
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCategoryTreeItem } from '@/api/category.types'
import type { DailyTransactionsResult } from '@/api/transaction.types'

const apiMocks = vi.hoisted(() => ({
  getDailyTransactions: vi.fn<typeof import('@/api/transaction.api').getDailyTransactions>(),
  getUserCategories: vi.fn<typeof import('@/api/category.api').getUserCategories>(),
  getUserTags: vi.fn<typeof import('@/api/tag.api').getUserTags>(),
}))
vi.mock('@/api/transaction.api', () => ({ getDailyTransactions: apiMocks.getDailyTransactions }))
vi.mock('@/api/category.api', () => ({ getUserCategories: apiMocks.getUserCategories }))
vi.mock('@/api/tag.api', () => ({ getUserTags: apiMocks.getUserTags }))
import TransactionsView from '@/views/transactions/TransactionsView.vue'
import TransactionFilters from '@/views/transactions/components/TransactionFilters.vue'

const primary = {
  id: 1,
  name: '数码产品',
  iconKey: 'icon-expense-digital',
  backgroundColor: '#6D7CE8',
  archived: false,
}
const secondary = {
  ...primary,
  id: 2,
  name: '电脑',
  iconKey: 'icon-expense-digital-computer',
  archived: true,
}
const income = { ...primary, id: 3, name: '工资', iconKey: 'icon-income-salary' }
function categoryTree(): UserCategoryTreeItem[] {
  return [
    {
      ...primary,
      type: 'expense',
      parentId: null,
      level: 1,
      sortOrder: 0,
      isDefault: true,
      children: [
        { ...secondary, type: 'expense', parentId: 1, level: 2, sortOrder: 0, isDefault: true },
      ],
    },
  ]
}
function createResult(): DailyTransactionsResult {
  return {
    period: '2026-10',
    totals: { expense: '1299.00', income: '1299.00', balance: '0.00' },
    filterTotals: { expense: '1299.00', income: '0.00' },
    days: [
      {
        date: '2026-10-10',
        expenseTotal: '1299.00',
        incomeTotal: '0.00',
        transactions: [
          {
            id: 7,
            type: 'expense',
            amount: '1299.00',
            title: '显示器',
            remark: '京东折扣',
            occurredDate: '2026-10-10',
            category: { primary, secondary },
            tags: [{ id: 1, name: '办公设备', archived: true }],
          },
        ],
      },
    ],
  }
}
const wrappers: VueWrapper[] = []
const stubs = {
  TTooltip: { template: '<span><slot /></span>' },
  TPopup: { template: '<div><slot /><slot name="content" /></div>' },
  TLoading: true,
  TDatePickerPanel: true,
  TCascader: {
    name: 'TCascader',
    props: ['value', 'options'],
    emits: ['change'],
    template: '<div />',
  },
  TSelect: { name: 'TSelect', props: ['value', 'options'], emits: ['change'], template: '<div />' },
}
function mountPage() {
  const wrapper = mount(TransactionsView, { global: { stubs } })
  wrappers.push(wrapper)
  return wrapper
}
describe('TransactionsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T12:00:00+08:00'))
    vi.clearAllMocks()
    apiMocks.getDailyTransactions.mockReset().mockResolvedValue(createResult())
    apiMocks.getUserCategories.mockImplementation((type: string) =>
      Promise.resolve(
        type === 'expense'
          ? categoryTree()
          : [
              {
                ...income,
                type: 'income',
                parentId: null,
                level: 1,
                sortOrder: 0,
                isDefault: true,
                children: [],
              },
            ],
      ),
    )
    apiMocks.getUserTags.mockResolvedValue([{ id: 1, name: '办公设备', archived: true }])
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('两种合计使用各自接口数据，展示分类标题、标签、备注与正确星期', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('[data-testid="period-income"]').text()).toBe('¥ 1,299.00')
    expect(wrapper.get('[data-testid="filter-income"]').text()).toBe('¥ 0.00')
    expect(wrapper.get('[data-testid="period-balance"]').text()).toBe('0.00')
    expect(wrapper.text()).toContain('10月10日，周六')
    expect(wrapper.text()).toContain('数码产品 - 电脑 · 显示器')
    expect(wrapper.find('[aria-label="标签：办公设备"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="备注：京东折扣"]').exists()).toBe(true)
    expect(apiMocks.getUserCategories).toHaveBeenCalledWith('expense', true)
    expect(apiMocks.getUserCategories).toHaveBeenCalledWith('income', true)
    expect(apiMocks.getUserTags).toHaveBeenCalledWith(true)
  })

  it('文本按300ms防抖，表单回车立即查询，顶部仍保留整个周期数据', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('#transaction-title').setValue('  显示器  ')
    expect(wrapper.text()).toContain('刷新中')
    expect(wrapper.get('[data-testid="period-income"]').text()).toBe('¥ 1,299.00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', title: '显示器' },
      expect.any(AbortSignal),
    )
    vi.advanceTimersByTime(300)
    expect(apiMocks.getDailyTransactions).toHaveBeenCalledTimes(2)
  })

  it('切换收支类型清除不匹配分类，历史归档项仍在筛选选项中', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const filters = wrapper.getComponent(TransactionFilters)
    const cascader = filters.getComponent({ name: 'TCascader' })
    expect(JSON.stringify(cascader.props('options'))).toContain('电脑（已归档）')
    cascader.vm.$emit('change', [2, 3])
    await flushPromises()
    const incomeButton = wrapper
      .findAll('.filter-type button')
      .find((button) => button.text() === '收入')
    if (!incomeButton) throw new Error('收入按钮不存在')
    await incomeButton.trigger('click')
    await flushPromises()
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', type: 'income', categoryIds: [3] },
      expect.any(AbortSignal),
    )
  })

  it('日期默认展开，折叠不触发查询或改变合计，未完成操作入口禁用', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('.daily-group__heading').attributes('aria-expanded')).toBe('true')
    await wrapper.get('.daily-group__heading').trigger('click')
    expect(wrapper.get('.daily-group__heading').attributes('aria-expanded')).toBe('false')
    expect(apiMocks.getDailyTransactions).toHaveBeenCalledTimes(1)
    expect(
      wrapper.get('button[aria-label="切换到月汇总（暂不可用）"]').attributes(),
    ).toHaveProperty('disabled')
    expect(wrapper.get('button[aria-label="新增流水（暂不可用）"]').attributes()).toHaveProperty(
      'disabled',
    )
    expect(wrapper.get('button[aria-label="编辑流水（暂不可用）"]').attributes()).toHaveProperty(
      'disabled',
    )
    expect(wrapper.get('button[aria-label="删除流水（暂不可用）"]').attributes()).toHaveProperty(
      'disabled',
    )
  })

  it('有流水但筛选为空时，即使周期结余为零也显示未匹配且无新增入口', async () => {
    apiMocks.getDailyTransactions.mockResolvedValue({
      ...createResult(),
      filterTotals: { expense: '0.00', income: '0.00' },
      days: [],
    })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('未找到匹配记录')
    expect(wrapper.find('.transaction-empty button').exists()).toBe(false)
    expect(wrapper.get('[data-testid="period-expense"]').text()).toBe('¥ 1,299.00')
  })

  it('整个周期无记录显示新增禁用入口，不把首次未知金额当作零', async () => {
    apiMocks.getDailyTransactions.mockResolvedValue({
      period: '2026-10',
      totals: { expense: '0.00', income: '0.00', balance: '0.00' },
      filterTotals: { expense: '0.00', income: '0.00' },
      days: [],
    })
    const wrapper = mountPage()
    expect(wrapper.get('[data-testid="period-expense"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="filter-expense"]').text()).toBe('—')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无账单记录')
    expect(wrapper.get('.transaction-empty button').attributes()).toHaveProperty('disabled')
  })

  it('加载失败保留列表与合计，并使用当前条件重试', async () => {
    const wrapper = mountPage()
    await flushPromises()
    apiMocks.getDailyTransactions.mockRejectedValueOnce(new Error('服务器不可用'))
    await wrapper.get('#transaction-title').setValue('显示器')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('刷新失败，保留上次结果')
    expect(wrapper.text()).toContain('服务器不可用')
    expect(wrapper.find('.transaction-row').exists()).toBe(true)
    await wrapper.get('.transaction-status button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.transaction-status').exists()).toBe(false)
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', title: '显示器' },
      expect.any(AbortSignal),
    )
  })
})
