/**
 * @author Brave
 * @date 2026-09-22 13:18:29
 * @description 分类模块服务层
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { AmountType } from '../amount-records/enums/amount-type-enum';
import { UserService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryEntity } from './entities/category.entity';
import { FindOptionsWhere, IsNull, Not, Repository } from 'typeorm';
import { UserCategorySortEntity } from './entities/user-category-sort.entity';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(UserCategorySortEntity)
    private readonly userCategoryRepo: Repository<UserCategorySortEntity>,
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
  ) {
    // 根据id查询用户
    const user = await this.userService.findeOneById(userId);

    if (!user) {
      throw new BadRequestException('用户不存在，获取分类列表失败');
    }

    // 是否要包含归档已归档分类
    const archiveCondition: FindOptionsWhere<CategoryEntity> = includeArchived
      ? {}
      : { archivedTime: IsNull() };

    // 查询用户下的所有分类，从分类表获取
    const allCategories = await this.categoryRepo.find({
      where: [
        {
          // 系统默认分类
          ownerUserId: IsNull(),
          type,
          ...archiveCondition,
        },
        {
          // 用户自定义分类
          ownerUserId: userId,
          type,
          ...archiveCondition,
        },
      ],
    });

    if (allCategories.length === 0) {
      return [];
    }

    // 查询当前用户的自定义排序分类，从用户分类排序表获取
    const sortedCategories = await this.userCategoryRepo.findBy({
      userId,
    });

    // 存在用户修改排序的分类，用它覆盖分类的默认排序
    if (sortedCategories.length > 0) {
      sortedCategories.map((item) => {
        allCategories.map((el) => {
          if (item.categoryId === el.id) el.defaultSort = item.sortOrder;
        });
      });
    }

    // 组装数据，返回一个一级分类包含二级分类的数组
    let parentList = allCategories.filter((item) => {
      return item.level === 1;
    });
  }
}
