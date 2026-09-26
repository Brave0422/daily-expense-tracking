/**
 * @author Brave
 * @date 2026-09-26T16:08:48+08:00
 * @description 分类业务接口类型，描述分类树、图标选项及新增编辑请求契约。
 */

export type CategoryType = 'expense' | 'income'
export type CategoryLevel = 1 | 2

export interface UserCategory {
  /** 当前用户分类主键。 */
  id: number
  /** 收支分类类型。 */
  type: CategoryType
  /** 一级分类为空，二级分类指向所属父类。 */
  parentId: number | null
  /** 用户当前使用的分类名称。 */
  name: string
  /** 同一排序范围内的展示顺序。 */
  sortOrder: number
  /** 分类层级。 */
  level: CategoryLevel
  /** 分类 SVG Symbol ID。 */
  iconKey: string
  /** 是否由默认分类模板初始化。 */
  isDefault: boolean
  /** 后端根据分类层级派生的最终图标背景色。 */
  backgroundColor: string
}

export interface UserCategoryTreeItem extends UserCategory {
  /** 当前一级分类下按顺序排列的二级分类。 */
  children: UserCategory[]
}

export interface CategoryIconOption {
  /** 分类 SVG Symbol ID。 */
  iconKey: string
  /** 图标库配置的默认背景色。 */
  backgroundColor: string
}

export interface CreateCategoryBody {
  type: CategoryType
  name: string
  iconKey: string
  parentId?: number
}

export interface UpdateCategoryBody {
  id: number
  name: string
  iconKey: string
}
