/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description 鉴权表单的 Zod 校验规则与字段错误转换。
 */

import { z } from 'zod'

const emailSchema = z.string().trim().min(1, '请输入邮箱').email('请输入正确的邮箱地址')
const passwordSchema = z.string().min(6, '密码至少 6 位').max(20, '密码最多 20 位')
const codeSchema = z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const registerSchema = loginSchema.extend({
  code: codeSchema,
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  newPassword: passwordSchema,
})

export const changePasswordSchema = resetPasswordSchema.pick({
  email: true,
  code: true,
  newPassword: true,
})

export type FieldErrors = Record<string, string>

export interface FormValidationResult<T> {
  /** 校验成功后的清洗数据。 */
  data?: T
  /** 按字段名索引的首条错误信息。 */
  errors: FieldErrors
  /** 是否通过全部规则。 */
  isValid: boolean
}

/**
 * 规范化后端采用的邮箱格式。
 * @param email - 用户输入邮箱
 * @returns 去除首尾空白并转为小写的邮箱
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * 校验表单并将首个字段错误转换为页面易消费的映射。
 * @param schema - 目标 Zod 规则
 * @param values - 待校验值
 * @returns 校验结果、清洗后数据与字段错误
 */
export function validateForm<T>(schema: z.ZodType<T>, values: unknown): FormValidationResult<T> {
  const result = schema.safeParse(values)
  if (result.success) {
    return { data: result.data, errors: {}, isValid: true }
  }

  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const fieldName = String(issue.path[0] ?? 'form')
    errors[fieldName] ??= issue.message
  }

  return { errors, isValid: false }
}
