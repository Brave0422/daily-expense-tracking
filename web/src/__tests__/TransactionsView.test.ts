/**
 * @author Brave
 * @date 2026-10-10T21:05:20+08:00
 * @description 账单页面双模式交互测试，覆盖统计口径、周期选择、筛选禁用、分类折叠和空状态。
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCategoryTreeItem } from '@/api/category.types'
import type { DailyTransactionsResult, MonthlySummaryResult } from '@/api/transaction.types'

const apiMocks = vi.hoisted(() => ({
  getDailyTransactions: vi.fn<typeof import('@/api/transaction.api').getDailyTransactions>(),
  getMonthlySummary: vi.fn<typeof import('@/api/transaction.api').getMonthlySummary>(),
  getUserCategories: vi.fn<typeof import('@/api/category.api').getUserCategories>(),
  getUserTags: vi.fn<typeof import('@/api/tag.api').getUserTags>(),
}))
vi.mock('@/api/transaction.api', () => ({
  getDailyTransactions: apiMocks.getDailyTransactions,
  getMonthlySummary: apiMocks.getMonthlySummary,
}))
vi.mock('@/api/category.api', () => ({ getUserCategories: apiMocks.getUserCategories }))
vi.mock('@/api/tag.api', () => ({ getUserTags: apiMocks.getUserTags }))
import TransactionsView from '@/views/transactions/TransactionsView.vue'
import TransactionFilters from '@/views/transactions/components/TransactionFilters.vue'
import TransactionMonthlyList from '@/views/transactions/components/TransactionMonthlyList.vue'
import TransactionCreateDialog from '@/views/transactions/components/TransactionCreateDialog.vue'
import CategoryIcon from '@/components/business/CategoryIcon.vue'

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
function createMonthlyResult(period = '2026'): MonthlySummaryResult {
  return {
    period,
    totals: { expense: '2000.00', income: '3000.00', balance: '1000.00' },
    filterTotals: { expense: '1300.00', income: '1800.00' },
    months: [
      {
        month: 10,
        expenseTotal: '1300.00',
        incomeTotal: '1500.00',
        expenseCategories: [
          { ...primary, amount: '1299.00', children: [{ ...secondary, amount: '1299.00' }] },
          {
            ...primary,
            id: 4,
            name: '餐饮',
            amount: '1.00',
            children: [{ ...secondary, id: 5, name: '早餐', amount: '1.00' }],
          },
        ],
        incomeCategories: [{ ...income, amount: '1500.00' }],
      },
      {
        month: 9,
        expenseTotal: '0.00',
        incomeTotal: '300.00',
        expenseCategories: [],
        incomeCategories: [{ ...income, amount: '300.00' }],
      },
    ],
  }
}
const wrappers: VueWrapper[] = []
const stubs = {
  TransactionCreateDialog: true,
  TTooltip: { template: '<span><slot /></span>' },
  TPopup: { template: '<div><slot /><slot name="content" /></div>' },
  TLoading: true,
  TDatePickerPanel: {
    name: 'TDatePickerPanel',
    props: ['value', 'mode', 'format'],
    emits: ['change'],
    template: '<div />',
  },
  TCascader: {
    name: 'TCascader',
    props: ['value', 'options'],
    emits: ['change'],
    template: '<div />',
  },
  TSelect: {
    name: 'TSelect',
    props: ['value', 'options', 'disabled', 'placeholder'],
    emits: ['change', 'enter'],
    template: '<div />',
  },
}
function mountPage(useRealDatePicker = false) {
  const wrapper = mount(TransactionsView, {
    global: {
      stubs: {
        ...stubs,
        TDatePickerPanel: useRealDatePicker ? false : stubs.TDatePickerPanel,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
describe('TransactionsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T12:00:00+08:00'))
    vi.clearAllMocks()
    apiMocks.getDailyTransactions.mockReset().mockResolvedValue(createResult())
    apiMocks.getMonthlySummary
      .mockReset()
      .mockImplementation(async (query) => createMonthlyResult(query.year))
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

  it('日期默认展开，折叠不触发查询或改变合计，新增入口可用', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('.daily-group__heading').attributes('aria-expanded')).toBe('true')
    await wrapper.get('.daily-group__heading').trigger('click')
    expect(wrapper.get('.daily-group__heading').attributes('aria-expanded')).toBe('false')
    expect(apiMocks.getDailyTransactions).toHaveBeenCalledTimes(1)
    expect(wrapper.get('button[aria-label="切换到月汇总"]').attributes()).not.toHaveProperty(
      'disabled',
    )
    expect(wrapper.get('button[aria-label="新增流水"]').attributes()).not.toHaveProperty('disabled')
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

  it('整个周期无记录显示新增入口，不把首次未知金额当作零', async () => {
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
    expect(wrapper.get('.transaction-empty button').attributes()).not.toHaveProperty('disabled')
    await wrapper.get('.transaction-empty button').trigger('click')
    expect(wrapper.getComponent(TransactionCreateDialog).props('visible')).toBe(true)
  })

  it('新增成功保留当前日明细周期和筛选并重新查询列表及合计', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('#transaction-title').setValue('显示器')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('button[aria-label="新增流水"]').trigger('click')
    const dialog = wrapper.getComponent(TransactionCreateDialog)
    expect(dialog.props('visible')).toBe(true)
    dialog.vm.$emit('submit-success')
    await flushPromises()
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', title: '显示器' },
      expect.any(AbortSignal),
    )
    expect(apiMocks.getDailyTransactions).toHaveBeenCalledTimes(3)
  })

  it('新增成功在月汇总模式刷新当前年份和分类筛选', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('button[aria-label="切换到月汇总"]').trigger('click')
    await flushPromises()
    wrapper.getComponent(TransactionFilters).vm.$emit('update:filters', {
      type: 'income',
      categoryIds: [3],
      title: '',
      tagIds: [],
      remark: '',
      minAmount: '',
      maxAmount: '',
    })
    await flushPromises()
    wrapper.getComponent(TransactionCreateDialog).vm.$emit('submit-success')
    await flushPromises()
    expect(apiMocks.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2026', type: 'income', categoryIds: [3] },
      expect.any(AbortSignal),
    )
    expect(apiMocks.getMonthlySummary).toHaveBeenCalledTimes(3)
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

  it('切换到年模式清空并禁用日筛选，控件事件不查询，切回不恢复旧条件', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const filters = wrapper.getComponent(TransactionFilters)
    const select = filters.getComponent({ name: 'TSelect' })
    select.vm.$emit('change', [1])
    await wrapper.get('#transaction-title').setValue('旧标题')
    await wrapper.get('#transaction-remark').setValue('旧备注')
    await wrapper.get('input[aria-label="最低金额"]').setValue('10')
    await wrapper.get('button[aria-label="切换到月汇总"]').trigger('click')
    await flushPromises()
    for (const id of ['transaction-title', 'transaction-remark']) {
      const input = wrapper.get(`#${id}`)
      expect(input.attributes()).toHaveProperty('disabled')
      expect(input.attributes('placeholder')).toBe('仅日明细可用')
      expect((input.element as HTMLInputElement).value).toBe('')
    }
    expect(select.props()).toMatchObject({ disabled: true, placeholder: '仅日明细可用', value: [] })
    expect(apiMocks.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2026', minAmount: '10' },
      expect.any(AbortSignal),
    )
    select.vm.$emit('change', [1])
    select.vm.$emit('enter')
    await wrapper.get('#transaction-title').trigger('input')
    vi.advanceTimersByTime(300)
    expect(apiMocks.getMonthlySummary).toHaveBeenCalledTimes(1)
    await wrapper.get('button[aria-label="切换到日明细"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('#transaction-title').attributes()).not.toHaveProperty('disabled')
    expect(select.props('disabled')).toBe(false)
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2026-10', minAmount: '10' },
      expect.any(AbortSignal),
    )
  })

  it('月汇总按接口顺序展示、仅最新月份默认展开，分类折叠不影响合计', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('button[aria-label="切换到月汇总"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('本年支出')
    expect(wrapper.get('[data-testid="period-expense"]').text()).toBe('¥ 2,000.00')
    expect(wrapper.get('[data-testid="filter-expense"]').text()).toBe('¥ 1,300.00')
    expect(wrapper.get('[data-testid="period-balance"]').text()).toBe('+ ¥ 1,000.00')
    const headings = wrapper.findAll('.monthly-group__heading')
    expect(headings.map((heading) => heading.find('.monthly-group__month').text())).toEqual([
      '▾ 10月',
      '▾ 9月',
    ])
    expect(headings.map((heading) => heading.attributes('aria-expanded'))).toEqual([
      'true',
      'false',
    ])
    const categories = wrapper.findAll('.monthly-category--expandable')
    expect(categories.map((category) => category.find('.monthly-category__name').text())).toEqual([
      '数码产品',
      '餐饮',
    ])
    expect(
      wrapper.findAll('.monthly-section').map((section) => section.attributes('aria-label')),
    ).toEqual(['支出分类汇总', '收入分类汇总'])
    await categories[0]?.trigger('click')
    expect(wrapper.text()).toContain('电脑（已归档）')
    const childIcon = wrapper.get('.monthly-categories--children').getComponent(CategoryIcon)
    expect(childIcon.props()).toMatchObject({
      iconKey: secondary.iconKey,
      backgroundColor: primary.backgroundColor,
    })
    expect(wrapper.find('.transaction-row').exists()).toBe(false)
    await headings[0]?.trigger('click')
    expect(
      wrapper.getComponent(TransactionMonthlyList).find('.monthly-group__content').exists(),
    ).toBe(false)
    expect(apiMocks.getMonthlySummary).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="filter-expense"]').text()).toBe('¥ 1,300.00')
    await headings[1]?.trigger('click')
    expect(headings[1]?.attributes('aria-expanded')).toBe('true')
  })

  it('年选择器使用YYYY参数，年模式重置保留年份，单类型仅显示对应月分类', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('button[aria-label="切换到月汇总"]').trigger('click')
    await flushPromises()
    const picker = wrapper.getComponent({ name: 'TDatePickerPanel' })
    expect(picker.props()).toMatchObject({
      value: '2026',
      mode: 'year',
      format: 'YYYY',
    })
    picker.vm.$emit('change', '2025')
    await flushPromises()
    expect(wrapper.get('.transaction-overview__period h2').text()).toBe('2025年')
    const expenseButton = wrapper
      .findAll('.filter-type button')
      .find((button) => button.text() === '支出')
    if (!expenseButton) throw new Error('支出按钮不存在')
    await expenseButton.trigger('click')
    await flushPromises()
    expect(wrapper.find('[aria-label="收入分类汇总"]').exists()).toBe(false)
    expect(wrapper.get('.monthly-group__totals').text()).not.toContain('收入')
    expect(wrapper.get('[data-testid="period-income"]').text()).toBe('¥ 3,000.00')
    await wrapper.get('.filter-reset').trigger('click')
    await flushPromises()
    expect(apiMocks.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2025' },
      expect.any(AbortSignal),
    )
    expect(wrapper.get('#transaction-title').attributes()).toHaveProperty('disabled')
    expect(wrapper.find('[aria-label="收入分类汇总"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="切换到日明细"]').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'TDatePickerPanel' }).props()).toMatchObject({
      value: '2025-12',
      mode: 'month',
      format: 'YYYY-MM',
    })
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2025-12' },
      expect.any(AbortSignal),
    )
  })

  it('年查询失败保留旧列表并明确周期，重试后区分筛选无匹配和全年无流水', async () => {
    const wrapper = mountPage()
    await flushPromises()
    apiMocks.getMonthlySummary.mockRejectedValueOnce(new Error('年度服务不可用'))
    await wrapper.get('button[aria-label="切换到月汇总"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('下方保留2026年10月的上次成功结果')
    expect(wrapper.find('.transaction-row').exists()).toBe(true)
    expect(wrapper.get('[data-testid="period-expense"]').text()).toBe('—')
    apiMocks.getMonthlySummary.mockResolvedValueOnce({
      ...createMonthlyResult(),
      months: [],
      filterTotals: { expense: '0.00', income: '0.00' },
    })
    await wrapper.get('.transaction-status button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('未找到匹配记录')
    expect(wrapper.get('[data-testid="period-expense"]').text()).toBe('¥ 2,000.00')
    apiMocks.getMonthlySummary.mockResolvedValueOnce({
      period: '2025',
      totals: { expense: '0.00', income: '0.00', balance: '0.00' },
      filterTotals: { expense: '0.00', income: '0.00' },
      months: [],
    })
    wrapper.getComponent({ name: 'TDatePickerPanel' }).vm.$emit('change', '2025')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无账单记录')
    expect(wrapper.text()).toContain('2025年还没有账单记录')
  })

  it('真实日期面板点击年份和月份，回调仍提交接口要求的周期格式', async () => {
    apiMocks.getDailyTransactions.mockImplementation(async (query) => ({
      ...createResult(),
      period: query.month,
    }))
    const wrapper = mountPage(true)
    await flushPromises()
    await wrapper.get('button[aria-label="切换到月汇总"]').trigger('click')
    await flushPromises()
    const yearCell = wrapper.findAll('.t-date-picker__cell').find((cell) => cell.text() === '2025')
    if (!yearCell) throw new Error('年份单元格不存在')
    await yearCell.trigger('click')
    await flushPromises()
    expect(apiMocks.getMonthlySummary).toHaveBeenLastCalledWith(
      { year: '2025' },
      expect.any(AbortSignal),
    )
    expect(wrapper.get('.transaction-overview__period h2').text()).toBe('2025年')
    await wrapper.get('button[aria-label="切换到日明细"]').trigger('click')
    await flushPromises()
    const monthCell = wrapper.findAllComponents({ name: 'TDatePickerCell' }).find((cell) => {
      const date: unknown = cell.props('value')
      return date instanceof Date && date.getFullYear() === 2025 && date.getMonth() === 1
    })
    if (!monthCell) throw new Error('月份单元格不存在')
    await monthCell.trigger('click')
    await flushPromises()
    expect(apiMocks.getDailyTransactions).toHaveBeenLastCalledWith(
      { month: '2025-02' },
      expect.any(AbortSignal),
    )
    expect(wrapper.get('.transaction-overview__period h2').text()).toBe('2025年2月')
  })
})
