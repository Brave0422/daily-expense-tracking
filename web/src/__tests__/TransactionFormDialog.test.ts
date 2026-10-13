/**
 * @author Brave
 * @date 2026-10-12T22:15:23+08:00
 * @description 流水新增编辑表单测试，覆盖精确金额、归档关联、提交保护及失败草稿。
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCategoryTreeItem } from '@/api/category.types'
import type { DailyTransactionItem } from '@/api/transaction.types'

const mocks = vi.hoisted(() => ({
  getUserCategories: vi.fn<typeof import('@/api/category.api').getUserCategories>(),
  checkTagName: vi.fn<typeof import('@/api/tag.api').checkTagName>(),
  createTag: vi.fn<typeof import('@/api/tag.api').createTag>(),
  updateTag: vi.fn<typeof import('@/api/tag.api').updateTag>(),
  createTransaction: vi.fn<typeof import('@/api/transaction.api').createTransaction>(),
  updateTransaction: vi.fn<typeof import('@/api/transaction.api').updateTransaction>(),
  success: vi.fn<(message: string) => Promise<void>>().mockResolvedValue(undefined),
}))
vi.mock('@/api/category.api', () => ({ getUserCategories: mocks.getUserCategories }))
vi.mock('@/api/tag.api', () => ({
  checkTagName: mocks.checkTagName,
  createTag: mocks.createTag,
  updateTag: mocks.updateTag,
}))
vi.mock('@/api/transaction.api', () => ({
  createTransaction: mocks.createTransaction,
  updateTransaction: mocks.updateTransaction,
}))
vi.mock('tdesign-vue-next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('tdesign-vue-next')>()),
  MessagePlugin: { success: mocks.success },
}))
import TransactionFormDialog from '@/views/transactions/components/TransactionFormDialog.vue'

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
const archivedTransaction: DailyTransactionItem = {
  id: 101,
  type: 'expense',
  amount: '17.28',
  occurredDate: '2026-10-11',
  title: '原标题',
  remark: '原备注',
  category: {
    primary: {
      id: 1,
      name: '餐饮',
      iconKey: category.iconKey,
      backgroundColor: '#fff',
      archived: false,
    },
    secondary: {
      id: 4,
      name: '旧分类',
      iconKey: category.iconKey,
      backgroundColor: '#fff',
      archived: true,
    },
  },
  tags: [{ id: 8, name: '旧标签', archived: true }],
}
function mountForm(
  visible = true,
  transaction?: DailyTransactionItem | null,
  useRealControls = false,
) {
  const wrapper = mount(TransactionFormDialog, {
    props: { visible, transaction },
    global: {
      stubs: {
        TDialog: {
          name: 'TDialog',
          props: ['visible', 'header', 'closeBtn', 'closeOnOverlayClick', 'closeOnEscKeydown'],
          template: '<div v-if="visible"><slot /></div>',
        },
        TCascader: useRealControls
          ? false
          : {
              name: 'TCascader',
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
  await wrapper.get('#transaction-form-amount').setValue(amount)
}
async function addTag(wrapper: VueWrapper, name = '工作') {
  await wrapper.get('.transaction-form__add-tag').trigger('click')
  await wrapper.get('#tag-name').setValue(name)
  await wrapper.get('.tag-form').trigger('submit')
  await flushPromises()
}

describe('TransactionFormDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T12:00:00+08:00'))
    vi.clearAllMocks()
    mocks.getUserCategories
      .mockReset()
      .mockImplementation(async (type) => (type === 'expense' ? [expense] : [income]))
    mocks.checkTagName.mockReset().mockResolvedValue(null)
    mocks.createTransaction.mockReset().mockResolvedValue(undefined)
    mocks.updateTransaction.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    vi.useRealTimers()
  })

  it('默认支出和今天，仅查询当前可用选项，切换类型清除分类', async () => {
    const wrapper = mountForm()
    await flushPromises()
    expect(mocks.getUserCategories).toHaveBeenCalledWith('expense')
    expect(wrapper.getComponent({ name: 'TDatePicker' }).props('value')).toBe('2026-10-12')
    expect(wrapper.get('.transaction-form__segments button').attributes('aria-pressed')).toBe(
      'true',
    )
    const cascader = wrapper.getComponent({ name: 'TCascader' })
    expect(JSON.stringify(cascader.props('options'))).not.toContain('旧分类')
    expect(wrapper.findComponent({ name: 'TSelect' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('添加标签')
    cascader.vm.$emit('change', 2)
    await wrapper.findAll('.transaction-form__segments button')[1]?.trigger('click')
    expect(cascader.props('value')).toBeUndefined()
    expect(cascader.props('options')).toEqual([{ value: 3, label: '工资' }])
  })

  it('提交完整支出字段，保留大金额字符串、去重标签并通知关闭和刷新', async () => {
    const wrapper = mountForm()
    await fillRequired(wrapper, '9999999999999.99')
    await wrapper.get('#transaction-form-title').setValue(' 午餐 ')
    await wrapper.get('#transaction-form-remark').setValue(' 折扣 ')
    await addTag(wrapper, ' 去新西兰旅游 ')
    await addTag(wrapper, '去新西兰旅游')
    expect(wrapper.text()).toContain('当前流水已添加该标签')
    await wrapper.get('.tag-form__actions button').trigger('click')
    expect(mocks.checkTagName).toHaveBeenCalledWith({ name: '去新西兰旅游' })
    expect(wrapper.findAll('.tag-list-item')).toHaveLength(1)
    wrapper.getComponent({ name: 'TDatePicker' }).vm.$emit('change', '2024-02-29')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenCalledWith({
      type: 'expense',
      categoryId: 2,
      amount: '9999999999999.99',
      occurredDate: '2024-02-29',
      title: '午餐',
      tagIds: [],
      tagNames: ['去新西兰旅游'],
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
    await wrapper.get('#transaction-form-amount').setValue('0.01')
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

  it('自由输入名称校验空白和超长字符，允许50个Unicode字符', async () => {
    const wrapper = mountForm()
    await flushPromises()
    await wrapper.get('.transaction-form__add-tag').trigger('click')
    await wrapper.get('#tag-name').setValue('   ')
    await wrapper.get('.tag-form').trigger('submit')
    expect(wrapper.text()).toContain('请输入标签名称')
    await wrapper.get('#tag-name').setValue('😀'.repeat(51))
    await wrapper.get('.tag-form').trigger('submit')
    expect(wrapper.text()).toContain('标签名称不能超过50个字符')
    expect(mocks.checkTagName).not.toHaveBeenCalled()
    await wrapper.get('#tag-name').setValue('😀'.repeat(50))
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.tag-list-item')).toHaveLength(1)
  })

  it('添加标签失败保留名称和流水草稿，提交期间阻止重复和关闭底层弹窗', async () => {
    let rejectRequest = (_error: Error): void => {
      throw new Error('请求未初始化')
    }
    mocks.checkTagName.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const wrapper = mountForm()
    await fillRequired(wrapper)
    await wrapper.get('.transaction-form__add-tag').trigger('click')
    await wrapper.get('#tag-name').setValue('去新西兰旅游')
    await wrapper.get('.tag-form').trigger('submit')
    await wrapper.get('.tag-form').trigger('submit')
    await wrapper.get('.transaction-form').trigger('submit')
    expect(mocks.checkTagName).toHaveBeenCalledTimes(1)
    expect(mocks.createTransaction).not.toHaveBeenCalled()
    const dialogs = wrapper
      .findAllComponents({ name: 'TDialog' })
      .filter((dialog) => dialog.props('visible'))
    for (const dialog of dialogs) {
      expect(dialog.props('closeOnEscKeydown')).toBe(false)
      dialog.vm.$emit('update:visible', false)
    }
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    rejectRequest(new Error('添加标签失败'))
    await flushPromises()
    expect(wrapper.text()).toContain('添加标签失败')
    expect(wrapper.get<HTMLInputElement>('#tag-name').element.value).toBe('去新西兰旅游')
    expect(wrapper.get<HTMLInputElement>('#transaction-form-amount').element.value).toBe('17.28')
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.tag-list-item').text()).toContain('去新西兰旅游')
  })

  it('切换编辑记录后迟到的标签响应不会加入新记录', async () => {
    let resolveRequest = (_tag: import('@/api/tag.types').UserTag): void => {
      throw new Error('请求未初始化')
    }
    mocks.checkTagName.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.get('.transaction-form__add-tag').trigger('click')
    await wrapper.get('#tag-name').setValue('旅行')
    await wrapper.get('.tag-form').trigger('submit')
    await wrapper.setProps({ transaction: { ...archivedTransaction, id: 102, tags: [] } })
    resolveRequest({ id: 7, name: '旅行', archived: false })
    await flushPromises()
    expect(wrapper.find('.tag-list-item').exists()).toBe(false)
    expect(wrapper.find('.tag-form').exists()).toBe(false)
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
    await wrapper.get('#transaction-form-title').setValue('😀'.repeat(51))
    await wrapper.get('#transaction-form-remark').setValue('中'.repeat(101))
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
    expect(wrapper.get<HTMLInputElement>('#transaction-form-amount').element.value).toBe('17.28')
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
    expect(wrapper.get<HTMLInputElement>('#transaction-form-amount').element.value).toBe('')
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

  it('编辑回填全部字段，类型只读，原归档分类和标签仍可展示保留', async () => {
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    expect(wrapper.getComponent({ name: 'TDialog' }).props('header')).toBe('编辑流水')
    expect(wrapper.find('.transaction-form__segments').exists()).toBe(false)
    expect(wrapper.get('.transaction-form__readonly-type').text()).toContain('支出')
    expect(mocks.getUserCategories).toHaveBeenCalledWith('expense', true)
    expect(mocks.getUserCategories).toHaveBeenCalledTimes(1)
    expect(wrapper.getComponent({ name: 'TCascader' }).props('value')).toBe(4)
    expect(JSON.stringify(wrapper.getComponent({ name: 'TCascader' }).props('options'))).toContain(
      '旧分类（已归档）',
    )
    expect(wrapper.get<HTMLInputElement>('#transaction-form-amount').element.value).toBe('17.28')
    expect(wrapper.get<HTMLInputElement>('#transaction-form-title').element.value).toBe('原标题')
    expect(wrapper.get<HTMLTextAreaElement>('#transaction-form-remark').element.value).toBe(
      '原备注',
    )
    expect(wrapper.getComponent({ name: 'TDatePicker' }).props('value')).toBe('2026-10-11')
    expect(wrapper.get('.tag-list-item').text()).toContain('旧标签（已归档）')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(101, {
      categoryId: 4,
      amount: '17.28',
      occurredDate: '2026-10-11',
      title: '原标题',
      tagIds: [8],
      remark: '原备注',
    })
    expect(mocks.createTransaction).not.toHaveBeenCalled()
    expect(mocks.success).toHaveBeenCalledWith('流水编辑成功')
    expect(wrapper.emitted('submit-success')).toHaveLength(1)
  })

  it('允许更换有效分类、移除归档标签和清空文本，草稿不修改原记录', async () => {
    const original = structuredClone(archivedTransaction)
    const wrapper = mountForm(true, original)
    await flushPromises()
    wrapper.getComponent({ name: 'TCascader' }).vm.$emit('change', 2)
    await wrapper.get('.tag-list-item__delete').trigger('click')
    await wrapper.get('#transaction-form-title').setValue('  ')
    await wrapper.get('#transaction-form-remark').setValue('')
    await wrapper.get('#transaction-form-amount').setValue('9999999999999.99')
    wrapper.getComponent({ name: 'TDatePicker' }).vm.$emit('change', '2024-02-29')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(101, {
      categoryId: 2,
      amount: '9999999999999.99',
      occurredDate: '2024-02-29',
      title: null,
      tagIds: [],
      remark: null,
    })
    expect(original).toEqual(archivedTransaction)
  })

  it('归档标签可移除，同名未归档标签须确认复用后才能加入草稿', async () => {
    mocks.checkTagName.mockResolvedValue({ id: 7, name: '旧标签', archived: false })
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.get('.tag-list-item__delete').trigger('click')
    await addTag(wrapper, '旧标签')
    expect(wrapper.text()).toContain('确认继续使用吗')
    expect(wrapper.find('.tag-list-item').exists()).toBe(false)
    await wrapper.get('.tag-reuse-dialog__actions button:last-child').trigger('click')
    expect(wrapper.get('.tag-list-item').text()).toContain('旧标签')
    expect(wrapper.text()).not.toContain('已归档')
    await wrapper.get('.transaction-form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ tagIds: [7] }),
    )
  })

  it('同名确认可以取消，保留输入；确认继续使用后不展示保存成功提示', async () => {
    mocks.checkTagName.mockResolvedValue({ id: 7, name: '去新西兰旅游', archived: false })
    const wrapper = mountForm()
    await fillRequired(wrapper)
    await addTag(wrapper, '去新西兰旅游')
    expect(wrapper.text()).toContain('已经存在同名标签')
    await wrapper.get('.tag-reuse-dialog__actions button:first-child').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#tag-name').element.value).toBe('去新西兰旅游')
    expect(wrapper.find('.tag-list-item').exists()).toBe(false)
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    await wrapper.get('.tag-reuse-dialog__actions button:last-child').trigger('click')
    expect(wrapper.findAll('.tag-list-item')).toHaveLength(1)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.createTransaction).not.toHaveBeenCalled()
    await wrapper.get('.transaction-form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [7] }))
  })

  it('点击新标签编辑草稿，支持200px宽度，取消流水不触发数据库写入', async () => {
    const wrapper = mountForm()
    await fillRequired(wrapper)
    await addTag(wrapper, '旅行')
    expect(wrapper.get('.tag-list-item').attributes('style')).toContain('max-width: 200px')
    await wrapper.get('.tag-list-item__content').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#tag-name').element.value).toBe('旅行')
    await wrapper.get('#tag-name').setValue('新西兰旅行')
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.tag-list-item')).toHaveLength(1)
    expect(wrapper.get('.tag-list-item').text()).toContain('新西兰旅行')
    expect(mocks.success).not.toHaveBeenCalled()
    await wrapper.get('.transaction-form__actions button:first-child').trigger('click')
    expect(mocks.createTransaction).not.toHaveBeenCalled()
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
    expect(mocks.createTag).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it('新草稿保存遇到并发重名后，编辑原名称仍然重新查重并询问复用', async () => {
    const wrapper = mountForm()
    await fillRequired(wrapper)
    await addTag(wrapper, '新西兰旅行')
    mocks.createTransaction.mockRejectedValueOnce(
      new Error('标签已存在，请重新编辑该标签并确认是否继续使用'),
    )
    await wrapper.get('.transaction-form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.tag-list-item').text()).toContain('新西兰旅行')
    mocks.checkTagName.mockResolvedValueOnce({ id: 7, name: '新西兰旅行', archived: false })
    await wrapper.get('.tag-list-item__content').trigger('click')
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('已经存在同名标签')
    await wrapper.get('.tag-reuse-dialog__actions button:last-child').trigger('click')
    await wrapper.get('.transaction-form').trigger('submit')
    await flushPromises()
    expect(mocks.createTransaction).toHaveBeenLastCalledWith(
      expect.objectContaining({ tagIds: [7] }),
    )
    expect(mocks.createTransaction.mock.calls[1]?.[0]).not.toHaveProperty('tagNames')
  })

  it('编辑已关联标签保留原id，随流水提交改名且不创建新标签', async () => {
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.get('.tag-list-item__content').trigger('click')
    await wrapper.get('#tag-name').setValue('新西兰旅行')
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(archivedTransaction.tags[0]?.name).toBe('旧标签')
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
    await wrapper.get('.transaction-form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ tagIds: [8], tagUpdates: [{ id: 8, name: '新西兰旅行' }] }),
    )
    expect(mocks.updateTransaction.mock.calls[0]?.[1]).not.toHaveProperty('tagNames')
    expect(mocks.createTag).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it('已有标签改名冲突时保留原标签，取消流水不会写入改名草稿', async () => {
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.get('.tag-list-item__content').trigger('click')
    mocks.checkTagName.mockResolvedValueOnce({ id: 9, name: '已有名称' })
    await wrapper.get('#tag-name').setValue('已有名称')
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('已经存在同名标签')
    expect(wrapper.find('.tag-reuse-dialog').exists()).toBe(false)
    await wrapper.get('#tag-name').setValue('新名称')
    await wrapper.get('.tag-form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.tag-list-item').text()).toContain('新名称')
    await wrapper.get('.transaction-form__actions button:first-child').trigger('click')
    expect(archivedTransaction.tags[0]?.name).toBe('旧标签')
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it('已有标签连续改名保留原id，改回原名时省略改名字段', async () => {
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    for (const name of ['新名称', '另一个名称', '旧标签']) {
      await wrapper.get('.tag-list-item__content').trigger('click')
      await wrapper.get('#tag-name').setValue(name)
      await wrapper.get('.tag-form').trigger('submit')
      await flushPromises()
    }
    await wrapper.get('.transaction-form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ tagIds: [8] }),
    )
    expect(mocks.updateTransaction.mock.calls[0]?.[1]).not.toHaveProperty('tagUpdates')
  })

  it('原父分类已归档时仅允许保留原子分类，不允许选择同父类下其他子分类', async () => {
    mocks.getUserCategories.mockResolvedValue([{ ...expense, archived: true }])
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    const cascader = wrapper.getComponent({ name: 'TCascader' })
    expect(cascader.props('options')).toEqual([
      {
        value: 1,
        label: '餐饮（已归档）',
        children: [{ value: 4, label: '旧分类（已归档）', disabled: true }],
      },
    ])
    cascader.vm.$emit('change', 2)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('请选择支出二级分类')
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
  })

  it('编辑收入保持只读类型并回填一级分类，重新打开其他记录重置草稿', async () => {
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.get('#transaction-form-title').setValue('未保存草稿')
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({
      visible: true,
      transaction: {
        ...archivedTransaction,
        id: 102,
        type: 'income',
        title: null,
        remark: null,
        tags: [],
        category: {
          primary: {
            id: 3,
            name: '工资',
            iconKey: category.iconKey,
            backgroundColor: '#fff',
            archived: false,
          },
          secondary: null,
        },
      },
    })
    await flushPromises()
    expect(wrapper.get('.transaction-form__readonly-type').text()).toContain('收入')
    expect(wrapper.get<HTMLInputElement>('#transaction-form-title').element.value).toBe('')
    expect(wrapper.getComponent({ name: 'TCascader' }).props('value')).toBe(3)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(102, {
      categoryId: 3,
      amount: '17.28',
      occurredDate: '2026-10-11',
      title: null,
      tagIds: [],
      remark: null,
    })
  })

  it('编辑失败保留草稿，提交期间阻止重复 PATCH 及关闭，重试后正常保存', async () => {
    let rejectRequest = (_error: Error): void => {
      throw new Error('请求未初始化')
    }
    mocks.updateTransaction.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.get('#transaction-form-title').setValue('修改后的标题')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(mocks.updateTransaction).toHaveBeenCalledTimes(1)
    const dialog = wrapper.getComponent({ name: 'TDialog' })
    expect(dialog.props()).toMatchObject({
      closeBtn: false,
      closeOnOverlayClick: false,
      closeOnEscKeydown: false,
    })
    dialog.vm.$emit('update:visible', false)
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    rejectRequest(new Error('流水记录不存在'))
    await flushPromises()
    expect(wrapper.text()).toContain('流水记录不存在')
    expect(wrapper.get<HTMLInputElement>('#transaction-form-title').element.value).toBe(
      '修改后的标题',
    )
    expect(wrapper.emitted('submit-success')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('submit-success')).toHaveLength(1)
  })

  it('编辑关闭后打开新增恢复默认值，没有上一条记录的类型、标签或草稿', async () => {
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.setProps({ visible: false, transaction: null })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(wrapper.getComponent({ name: 'TDialog' }).props('header')).toBe('新增流水')
    expect(wrapper.find('.transaction-form__readonly-type').exists()).toBe(false)
    expect(wrapper.find('.tag-list-item').exists()).toBe(false)
    expect(wrapper.getComponent({ name: 'TCascader' }).props('value')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('#transaction-form-amount').element.value).toBe('')
    expect(wrapper.getComponent({ name: 'TDatePicker' }).props('value')).toBe('2026-10-12')
  })

  it('真实级联控件回显归档分类，真实标签关闭按钮可移除归档标签', async () => {
    const wrapper = mountForm(true, archivedTransaction, true)
    await flushPromises()
    const cascader = wrapper.getComponent({ name: 'TCascader' })
    expect(cascader.get<HTMLInputElement>('input').element.value).toContain('旧分类（已归档）')
    expect(wrapper.get('.tag-list-item').text()).toContain('旧标签（已归档）')
    await wrapper.get('.tag-list-item__delete').trigger('click')
    await flushPromises()
    expect(wrapper.find('.tag-list-item').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ categoryId: 4, tagIds: [] }),
    )
  })

  it('切换编辑目标后，旧分类请求的迟到错误不会覆盖新记录和选项', async () => {
    let rejectOldRequest = (_error: Error): void => {
      throw new Error('请求未初始化')
    }
    mocks.getUserCategories.mockImplementationOnce(
      () =>
        new Promise<UserCategoryTreeItem[]>((_resolve, reject) => {
          rejectOldRequest = reject
        }),
    )
    const wrapper = mountForm(true, archivedTransaction)
    await flushPromises()
    await wrapper.setProps({
      transaction: {
        ...archivedTransaction,
        id: 102,
        type: 'income',
        category: {
          primary: {
            id: 3,
            name: '工资',
            iconKey: category.iconKey,
            backgroundColor: '#fff',
            archived: false,
          },
          secondary: null,
        },
        tags: [],
      },
    })
    await flushPromises()
    rejectOldRequest(new Error('旧请求失败'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('旧请求失败')
    expect(wrapper.getComponent({ name: 'TCascader' }).props('options')).toEqual([
      { value: 3, label: '工资' },
    ])
    expect(wrapper.find('.tag-list-item').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      102,
      expect.objectContaining({ categoryId: 3, tagIds: [] }),
    )
  })
})
