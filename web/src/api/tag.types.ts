/**
 * @author Brave
 * @date 2026-09-27T18:34:34+08:00
 * @description 标签业务接口类型，描述用户标签及新增编辑请求契约。
 */

export interface UserTag {
  /** 当前用户标签主键。 */
  id: number
  /** 标签展示名称。 */
  name: string
}

export interface TagNameBody {
  name: string
}
