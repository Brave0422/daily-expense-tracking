/**
 * @author Brave
 * @date 2026-09-22 13:18:29
 * @description 分类模块服务层
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { AmountType } from '../amount-records/enums/amount-type-enum';
import { UserService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryTplEntity } from './entities/category-template.entity';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { UserCategoryEntity } from './entities/user-category.entity';

export interface UserCategoryTreeItem extends UserCategoryEntity {
  // 当前一级分类下按顺序排列的二级分类
  children: UserCategoryEntity[];
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(CategoryTplEntity)
    private readonly categoryRepo: Repository<CategoryTplEntity>,
    @InjectRepository(UserCategoryEntity)
    private readonly userCategoryRepo: Repository<UserCategoryEntity>,
  ) {}

  /**
   * 获取用户所有分类
   * @param userId 用户id
   * @param type 金额类型
   * @param includeArchived 是否包含已归档分类
   */
  async findAllForUser(
    userId: number,
    type: AmountType,
    includeArchived: boolean = false,
  ): Promise<UserCategoryTreeItem[]> {
    // 根据id查询用户
    const user = await this.userService.findeOneById(userId);

    if (!user) {
      throw new BadRequestException('用户不存在，获取分类列表失败');
    }

    // 构建查询归档分类的条件
    const archiveCondition: FindOptionsWhere<UserCategoryEntity> =
      includeArchived ? {} : { archivedTime: IsNull() };

    // 查询用户所有分类
    let allCategories = await this.userCategoryRepo.findBy({
      ownerUserId: userId,
      type,
      ...archiveCondition,
    });

    // 用户没有分类 ，说明是新用户，初始化分类模板到用户的分类
    if (!includeArchived && allCategories.length === 0) {
      try {
        const defaultCategory = await this.categoryRepo.find();

        // 生成用户分类数组
        const tempCategory: Omit<
          UserCategoryEntity,
          'id' | 'archivedTime' | 'createdTime' | 'updatedTime'
        >[] = defaultCategory.map((item) => {
          return {
            ownerUserId: userId,
            sourceTplId: item.id,
            type: item.type,
            parentId: item.parentId,
            name: item.name,
            sortOrder: item.defaultSort,
            level: item.level,
            iconKey: item.iconKey,
          };
        });

        // 创建用户分类实体
        const saveData = this.userCategoryRepo.create(tempCategory);
        // 保存实体
        allCategories = await this.userCategoryRepo.save(saveData);
      } catch {}
    }

    // 组装数据，按顺序排列一级分类，并把二级分类按照顺序放到对应的一级分类下面

    // 优先按order排序，order相同按照id排序
    const compareBySortOrder = (
      firstCategory: UserCategoryEntity,
      secondCategory: UserCategoryEntity,
    ): number =>
      firstCategory.sortOrder - secondCategory.sortOrder ||
      firstCategory.id - secondCategory.id;

    // 设置一级分类id为key，对应二级分类为value的map
    const childrenByParentId = new Map<number, UserCategoryEntity[]>();

    // 获取所有二级分类并排序
    const sortedChildren = allCategories
      .filter((category) => category.level === 2 && category.parentId !== null)
      .sort(compareBySortOrder);

    for (const category of sortedChildren) {
      const parentId = category.parentId;
      if (parentId === null) {
        continue;
      }

      // 往一级分类下增加对应二级分类
      const children = childrenByParentId.get(parentId);
      if (children) {
        children.push(category);
        continue;
      }
      // 设置一级分类key
      childrenByParentId.set(parentId, [category]);
    }

    return allCategories
      .filter((category) => category.level === 1)
      .sort(compareBySortOrder)
      .map((category) => ({
        ...category,
        children: childrenByParentId.get(category.id) ?? [],
      }));
  }
}
