/**
 * @author Brave
 * @date 2026-09-20T15:30:16+08:00
 * @description 邮箱验证码组件测试，覆盖倒计时、邮箱变化清空与防重复发送。
 */

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { sendVerificationCode } from '@/api/auth.api'
import type { SendVerificationCodeBody } from '@/api/auth.types'
import AuthCodeField from '@/components/business/AuthCodeField.vue'

vi.mock('@/api/auth.api', () => ({
  sendVerificationCode: vi.fn<(body: SendVerificationCodeBody) => Promise<void>>(),
}))

describe('AuthCodeField', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('starts a 60 second countdown after sending and clears code when email changes', async () => {
    vi.useFakeTimers()
    vi.mocked(sendVerificationCode).mockResolvedValue()
    const wrapper = mount(AuthCodeField, {
      props: {
        id: 'code',
        email: 'user@example.com',
        modelValue: '123456',
        purpose: 'register',
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(sendVerificationCode).toHaveBeenCalledWith({
      email: 'user@example.com',
      purpose: 'register',
    })
    expect(wrapper.get('button').text()).toContain('60s')

    await wrapper.setProps({ email: 'next@example.com' })
    expect(wrapper.emitted('update:modelValue')).toContainEqual([''])
  })

  it('does not send duplicate requests while a send is pending', async () => {
    let resolveRequest: (() => void) | undefined
    vi.mocked(sendVerificationCode).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
        }),
    )
    const wrapper = mount(AuthCodeField, {
      props: {
        id: 'code',
        email: 'user@example.com',
        modelValue: '',
        purpose: 'register',
      },
    })

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')

    expect(sendVerificationCode).toHaveBeenCalledTimes(1)
    resolveRequest?.()
    await flushPromises()
  })
})
