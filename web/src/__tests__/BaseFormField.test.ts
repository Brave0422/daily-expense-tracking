/**
 * @author Brave
 * @date 2026-09-20T17:31:21+08:00
 * @description 鉴权表单输入组件测试，验证密码显隐图标与输入类型同步切换。
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseFormField from '@/components/base/BaseFormField.vue'

describe('BaseFormField', () => {
  it('使用图标切换密码的显示和隐藏状态', async () => {
    const wrapper = mount(BaseFormField, {
      props: {
        id: 'password',
        label: '密码',
        modelValue: 'secret',
        type: 'password',
      },
    })
    const input = wrapper.get('input')
    const toggleButton = wrapper.get('button')

    expect(input.attributes('type')).toBe('password')
    expect(toggleButton.attributes('aria-label')).toBe('显示密码')
    expect(toggleButton.get('use').attributes('href')).toBe('#icon-show')
    expect(toggleButton.text()).toBe('')

    await toggleButton.trigger('click')

    expect(input.attributes('type')).toBe('text')
    expect(toggleButton.attributes('aria-label')).toBe('隐藏密码')
    expect(toggleButton.get('use').attributes('href')).toBe('#icon-hide')
  })
})
