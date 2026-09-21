/**
 * @author Brave
 * @date 2026-09-21T11:00:11+08:00
 * @description 默认业务布局测试，验证头像菜单外部点击与侧栏导航可以同时生效。
 */

import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import DefaultLayout from '@/layouts/DefaultLayout.vue'

const EmptyStub = { template: '<div />' }
const TooltipStub = { template: '<div><slot /></div>' }

describe('DefaultLayout', () => {
  it('点击头像菜单外的统计入口时关闭菜单并完成导航', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/records', name: 'records', component: EmptyStub },
        { path: '/statistics', name: 'statistics', component: EmptyStub },
        { path: '/management', name: 'management', component: EmptyStub },
      ],
    })
    await router.push('/records')
    await router.isReady()

    const wrapper = mount(DefaultLayout, {
      attachTo: document.body,
      global: {
        plugins: [createPinia(), router],
        stubs: {
          ChangePasswordDialog: EmptyStub,
          TDialog: EmptyStub,
          TTooltip: TooltipStub,
        },
      },
    })

    await wrapper.get('.default-layout__avatar').trigger('click')
    expect(wrapper.find('.profile-menu').exists()).toBe(true)

    await wrapper.get('[aria-label="账单统计"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.profile-menu').exists()).toBe(false)
    expect(router.currentRoute.value.name).toBe('statistics')
    expect(wrapper.get('[aria-label="账单统计"]').classes()).toContain(
      'default-layout__nav-link--active',
    )

    wrapper.unmount()
  })
})
