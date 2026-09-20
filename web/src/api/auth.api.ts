/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description 鉴权业务接口，按 NestJS 统一响应结构解包数据。
 */

import { apiClient } from './http'
import type {
  AccessTokenData,
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  SendVerificationCodeBody,
} from './auth.types'
import type { ApiResponse } from './common.types'

/**
 * 调用 POST /auth/login 建立服务端会话。
 * @param body - 已按后端规则清洗的邮箱与明文密码
 * @returns 仅供内存保存的 Access Token 数据
 */
export async function login(body: LoginBody): Promise<AccessTokenData> {
  const response = await apiClient.post<ApiResponse<AccessTokenData>>('/auth/login', body)
  return response.data.data
}

/**
 * 调用 POST /auth/register 注册新账号。
 * @param body - 邮箱、密码与注册验证码
 * @returns 后端注册成功标记
 */
export async function register(body: RegisterBody): Promise<boolean> {
  const response = await apiClient.post<ApiResponse<boolean>>('/auth/register', body)
  return response.data.data
}

/**
 * 调用 POST /auth/refresh，使用浏览器自动携带的 HttpOnly Cookie 恢复会话。
 * @returns 新的 Access Token 数据
 */
export async function refreshSession(): Promise<AccessTokenData> {
  const response = await apiClient.post<ApiResponse<AccessTokenData>>('/auth/refresh')
  return response.data.data
}

/**
 * 调用 POST /auth/logout 撤销服务端会话并清除 Refresh Cookie。
 * @returns 服务端完成退出后结束；失败时由调用层保留本地会话
 */
export async function logout(): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/auth/logout')
}

/**
 * 调用 POST /auth/resetPassword，通过邮箱验证码重置密码。
 * @param body - 邮箱、验证码与新密码
 * @returns 后端重置成功标记
 */
export async function resetPassword(body: ResetPasswordBody): Promise<boolean> {
  const response = await apiClient.post<ApiResponse<boolean>>('/auth/resetPassword', body)
  return response.data.data
}

/**
 * 调用 POST /auth/changePassword，为当前登录用户修改密码。
 * @param body - 修改密码验证码与新密码；邮箱只用于发送验证码，不进入此接口
 * @returns 后端修改成功标记
 */
export async function changePassword(body: ChangePasswordBody): Promise<boolean> {
  const response = await apiClient.post<ApiResponse<boolean>>('/auth/changePassword', body)
  return response.data.data
}

/**
 * 调用 POST /verificationCode/sendCode 发送六位邮箱验证码。
 * @param body - 验证码用途；公共场景同时携带接收邮箱
 * @returns 后端接受发送任务后结束
 */
export async function sendVerificationCode(body: SendVerificationCodeBody): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/verificationCode/sendCode', body, {
    // 修改密码验证码需要登录态续期；注册与重置密码是访客接口，不应触发刷新。
    skipAuthRefresh: body.purpose !== 'change_password',
  })
}
