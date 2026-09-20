/**
 * @author Brave
 * @date 2026-09-18T17:49:29+08:00
 * @description 应用根组件测试，确认路由页面出口正常渲染。
 */

import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders the active route outlet', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: { template: '<main>当前页面</main>' },
        },
      },
    })

    expect(wrapper.text()).toContain('当前页面')
  })
})
