/**
 * @author Brave
 * @date 2026-10-12T22:15:23+08:00
 * @description 新增流水表单测试，覆盖可用分类、精确金额、默认日期、提交保护和失败草稿。
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCategoryTreeItem } from '@/api/category.types'

const mocks = vi.hoisted(() => ({
  getUserCategories: vi.fn<typeof import('@/api/category.api').getUserCategories>(),
  getUserTags: vi.fn<typeof import('@/api/tag.api').getUserTags>(),
  createTransaction: vi.fn<typeof import('@/api/transaction.api').createTransaction>(),
  success: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/category.api', () => ({ getUserCategories: mocks.getUserCategories }))
vi.mock('@/api/tag.api', () => ({ getUserTags: mocks.getUserTags }))
vi.mock('@/api/transaction.api', () => ({ createTransaction: mocks.createTransaction }))
vi.mock('tdesign-vue-next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('tdesign-vue-next')>()),
  MessagePlugin: { success: mocks.success },
}))
import TransactionCreateDialog from '@/views/transactions/components/TransactionCreateDialog.vue'

const category = {
  name: '餐饮',
  iconKey: 'icon-expense-food',
  backgroundColor: '#fff',
  sortOrder: 0,
  isDefault: true,
  archived: false,
}
const expense: UserCategoryTreeItem = {
  ...category,
  id: 1,
  type: 'expense',
  level: 1,
  parentId: null,
  children: [
    { ...category, id: 2, name: '午餐', type: 'expense', level: 2, parentId: 1 },
    { ...category, id: 4, name: '旧分类', type: 'expense', level: 2, parentId: 1, archived: true },
  ],
}
const income: UserCategoryTreeItem = {
  ...category,
  id: 3,
  name: '工资',
  type: 'income',
  level: 1,
  parentId: null,
  children: [],
}
const wrappers: VueWrapper[] = []
function mountForm(visible = true) {
  const wrapper = mount(TransactionCreateDialog, {
    props: { visible },
    global: {
      stubs: {
        TDialog: {
          name: 'TDialog',
          props: ['visible', 'closeBtn', 'closeOnOverlayClick', 'closeOnEscKeydown'],
          template: '<div v-if="visible"><slot /></div>',
        },
        TCascader: {
          name: 'TCascader',
          props: ['value', 'options', 'disabled'],
          emits: ['change'],
          template: '<div />',
        },
        TSelect: {
          name: 'TSelect',
          props: ['value', 'options', 'disabled'],
          emits: ['change'],
          template: '<div />',
        },
        TDatePicker: {
          name: 'TDatePicker',
          props: ['value', 'disabled'],
          emits: ['change'],
          template: '<div />',
        },
        TButton: {
          props: ['loading', 'disabled', 'type'],
          template: '<button :type="type" :disabled="loading || disabled"><slot /></button>',
        },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
async function fillRequired(wrapper: VueWrapper, amount = '17.28') {
  await flushPromises()
  wrapper.getComponent({ name: 'TCascader' }).vm.$emit('change', 2)
  await wrapper.get('#create-transaction-amount').setValue(amount)
}

describe('TransactionCreateDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T12:00:00+08:00'))
    vi.clearAllMocks()
    mocks.getUserCategories
      .mockReset()
      .mockImplementation(async (type) => (type === 'expense' ? [expense] : [income]))
    mocks.getUserTags.mockReset().mockResolvedValue([
      { id: 7, name: '工作' },
      { id: 8, name: '旧标签', archived: true },
    ])
    mocks.createTransaction.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    vi.useRealTimers()
  })

  it('默认支出和今天，仅查询当前可用选项，切换类型清除分类', async () => {
    const wrapper = mountForm()
    await flushPromises()
    expect(mocks.getUserCategories).toHaveBeenCalledWith('expense')
    expect(mocks.getUserTags).toHaveBeenCalledWith()
    expect(wrapper.getComponent({ name: 'TDatePicker' }).props('value')).toBe('2026-10-12')
    expect(wrapper.get('.transaction-form__segments button').attributes('aria-pressed')).toBe(
      'true',
    )
    const cascader = wrapper.getComponent({ name: 'TCascader' })
    expect(JSON.stringify(cascader.props('options'))).not.toContain('旧分类')
    expect(wrapper.getComponent({ name: 'TSelect' }).props('options')).toEqual([
      { value: 7, label: '工作' },
    ])
    cascader.vm.$emit('change', 2)
    await wrapper.findAll('.transaction-form__segments button')[1]?.trigger('click')
    expect(cascader.props('value')).toBeUndefined()
    expect(cascader.props('options')).toEqual([{ value: 3, label: '工资' }])
  })

  it('提交完整支出字段，保留大金额字符串、去重标签并通知关闭和刷新', async () => {
    const wrapper = mountForm()
    await fillRequired(wrapper, '9999999999999.99')
    await wrapper.get('#create-transaction-title').setValue(' 午餐 ')
    await wrapper.get('#create-transaction-remark').setValue(' 折扣 ')
    wrapper.getComponent({ name: 'TSelect' }).vm.$emit('change', [7, 7])
    wrapper.getComponent({ name: 'TDatePicker' }).vm.$emit('change', '2024-02-29')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenCalledWith({
      type: 'expense',
      categoryId: 2,
      amount: '9999999999999.99',
      occurredDate: '2024-02-29',
      title: '午餐',
      tagIds: [7],
      remark: '折扣',
    })
    expect(wrapper.emitted('submit-success')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('收入允许一级分类和省略文本标签，空文本提交 NULL', async () => {
    const wrapper = mountForm()
    await flushPromises()
    await wrapper.findAll('.transaction-form__segments button')[1]?.trigger('click')
    wrapper.getComponent({ name: 'TCascader' }).vm.$emit('change', 3)
    await wrapper.get('#create-transaction-amount').setValue('0.01')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenCalledWith({
      type: 'income',
      categoryId: 3,
      amount: '0.01',
      occurredDate: '2026-10-12',
      title: null,
      tagIds: [],
      remark: null,
    })
  })

  it.each(['0', '0.00', '-1', '1.001', '1e3', '10000000000000'])(
    '拒绝无效金额 %s',
    async (amount) => {
      const wrapper = mountForm()
      await fillRequired(wrapper, amount)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.text()).toContain('金额必须大于0')
      expect(mocks.createTransaction).not.toHaveBeenCalled()
    },
  )

  it('拒绝支出一级分类、无效自然日期及超长 Unicode 文本', async () => {
    const wrapper = mountForm()
    await fillRequired(wrapper)
    wrapper.getComponent({ name: 'TCascader' }).vm.$emit('change', 1)
    wrapper.getComponent({ name: 'TDatePicker' }).vm.$emit('change', '2026-02-30')
    await wrapper.get('#create-transaction-title').setValue('😀'.repeat(51))
    await wrapper.get('#create-transaction-remark').setValue('中'.repeat(101))
    await wrapper.get('form').trigger('submit')
    for (const message of [
      '请选择支出二级分类',
      '请选择有效的发生日期',
      '标题不能超过50',
      '备注不能超过100',
    ]) {
      expect(wrapper.text()).toContain(message)
    }
    expect(mocks.createTransaction).not.toHaveBeenCalled()
  })

  it('提交期间阻止重复写入和关闭，失败保留输入并允许重试', async () => {
    let rejectRequest: (error: Error) => void = () => {
      throw new Error('请求未初始化')
    }
    mocks.createTransaction.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const wrapper = mountForm()
    await fillRequired(wrapper)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(mocks.createTransaction).toHaveBeenCalledTimes(1)
    const dialog = wrapper.getComponent({ name: 'TDialog' })
    expect(dialog.props('closeOnEscKeydown')).toBe(false)
    expect(dialog.props('closeOnOverlayClick')).toBe(false)
    dialog.vm.$emit('update:visible', false)
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    rejectRequest(new Error('标签不存在或已归档'))
    await flushPromises()
    expect(wrapper.text()).toContain('标签不存在或已归档')
    expect(wrapper.get<HTMLInputElement>('#create-transaction-amount').element.value).toBe('17.28')
    expect(wrapper.emitted('submit-success')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('submit-success')).toHaveLength(1)
  })

  it('关闭后重新打开重置默认值并重新加载选项', async () => {
    const wrapper = mountForm()
    await fillRequired(wrapper)
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('#create-transaction-amount').element.value).toBe('')
    expect(wrapper.getComponent({ name: 'TCascader' }).props('value')).toBeUndefined()
    expect(mocks.getUserCategories).toHaveBeenCalledTimes(4)
  })

  it('分类加载失败可重试，失败时不会提交空分类', async () => {
    mocks.getUserCategories.mockRejectedValueOnce(new Error('分类加载失败'))
    const wrapper = mountForm()
    await flushPromises()
    expect(wrapper.text()).toContain('分类加载失败')
    await wrapper.get('form').trigger('submit')
    expect(mocks.createTransaction).not.toHaveBeenCalled()
    await wrapper.get('.transaction-form__error button').trigger('click')
    await fillRequired(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenCalledTimes(1)
  })
})
