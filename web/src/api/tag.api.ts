/**
 * @author Brave
 * @date 2026-09-27T18:34:34+08:00
 * @description 标签业务接口，负责当前用户标签列表及增删改请求的发送与响应解包。
 */

import type { ApiResponse } from './common.types'
import { apiClient } from './http'
import type { TagNameBody, UserTag } from './tag.types'

/** 获取当前用户的全部未归档标签。 */
export async function getUserTags(): Promise<UserTag[]> {
  const response = await apiClient.get<ApiResponse<UserTag[]>>('/tags')
  return response.data.data
}

/** 创建当前用户的标签。 */
export async function createTag(body: TagNameBody): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/tags', body)
}

/** 编辑当前用户的标签名称。 */
export async function updateTag(tagId: number, body: TagNameBody): Promise<void> {
  await apiClient.patch<ApiResponse<void>>(`/tags/${tagId}`, body)
}

/** 逻辑归档当前用户的指定标签。 */
export async function deleteTag(tagId: number): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`/tags/${tagId}/archive`)
}
