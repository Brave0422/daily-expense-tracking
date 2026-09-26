/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 分类业务接口，负责分类树、图标库及分类增删改请求的发送与响应解包。
 */

import type {
  CategoryIconOption,
  CategoryType,
  CreateCategoryBody,
  UpdateCategoryBody,
  UserCategoryTreeItem,
} from './category.types'
import type { ApiResponse } from './common.types'
import { apiClient } from './http'

/** 获取当前用户指定收支类型的未归档分类树。 */
export async function getUserCategories(type: CategoryType): Promise<UserCategoryTreeItem[]> {
  const response = await apiClient.get<ApiResponse<UserCategoryTreeItem[]>>(
    '/categories/getUserCategories',
    { params: { type } },
  )
  return response.data.data
}

/** 获取全局只读分类图标库。 */
export async function getCategoryIcons(): Promise<CategoryIconOption[]> {
  const response = await apiClient.get<ApiResponse<CategoryIconOption[]>>('/categories/getAllIcons')
  return response.data.data
}

/** 创建当前用户的自定义分类。 */
export async function createCategory(body: CreateCategoryBody): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/categories/create', body)
}

/** 完整提交分类当前名称和图标并执行编辑。 */
export async function updateCategory(body: UpdateCategoryBody): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/categories/update', body)
}

/** 逻辑归档当前用户的指定分类。 */
export async function deleteCategory(categoryId: number): Promise<void> {
  await apiClient.delete<ApiResponse<void>>(`/categories/${categoryId}/archive`)
}
