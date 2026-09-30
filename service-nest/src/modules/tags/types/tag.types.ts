/**
 * @author Brave
 * @date 2026-09-27T13:08:05+08:00
 * @description 标签模块对外类型，定义控制层与服务层共享的响应结构。
 */

/** 用户可见的标签列表项。 */
export interface TagListItem {
  id: number;
  name: string;
}

/** 用于账单筛选的标签项，包含归档状态。 */
export interface TagFilterListItem extends TagListItem {
  archived: boolean;
}
