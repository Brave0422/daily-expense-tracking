/**
 * @author Brave
 * @date 2026-09-20T15:30:16+08:00
 * @description 鉴权表单规则测试，覆盖邮箱清洗、密码长度和验证码格式。
 */

import { describe, expect, it } from 'vitest'

import {
  changePasswordSchema,
  loginSchema,
  normalizeEmail,
  registerSchema,
  validateForm,
} from '@/utils/auth-validation'

describe('auth validation', () => {
  it('normalizes email before submission', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('rejects passwords outside the backend 6 to 20 character contract', () => {
    const shortPassword = validateForm(loginSchema, {
      email: 'user@example.com',
      password: '12345',
    })
    const longPassword = validateForm(loginSchema, {
      email: 'user@example.com',
      password: '123456789012345678901',
    })

    expect(shortPassword.errors.password).toBe('密码至少 6 位')
    expect(longPassword.errors.password).toBe('密码最多 20 位')
  })

  it('accepts only six digit verification codes', () => {
    const invalidResult = validateForm(registerSchema, {
      email: 'user@example.com',
      password: '123456',
      code: '12a456',
    })
    const validResult = validateForm(registerSchema, {
      email: 'user@example.com',
      password: '123456',
      code: '012345',
    })

    expect(invalidResult.errors.code).toBe('请输入 6 位数字验证码')
    expect(validResult.isValid).toBe(true)
  })

  it('validates a password change without requiring an email', () => {
    const result = validateForm(changePasswordSchema, {
      code: '012345',
      newPassword: '123456',
    })

    expect(result.isValid).toBe(true)
    expect(result.data).toEqual({ code: '012345', newPassword: '123456' })
  })
})
