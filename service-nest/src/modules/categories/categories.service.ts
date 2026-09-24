/**
 * @author Brave
 * @date 2026-09-22 13:18:29
 * @description 分类模块服务层
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AmountType } from '../amount-records/enums/amount-type-enum';
import { UserService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryTplEntity } from './entities/category-template.entity';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { UserCategoryEntity } from './entities/user-category.entity';
import { CategoryIconEntity } from './entities/category-icon.entity';
import { IconKey } from './enums/icon-key-enum';

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
    @InjectRepository(CategoryIconEntity)
    private readonly categoryIconEntity: Repository<CategoryIconEntity>,
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
      } catch {
        throw new InternalServerErrorException(
          '初始化用户分类错误，请稍后再试',
        );
      }
    }

    // 组装数据，按顺序排列一级分类，并把二级分类按照顺序放到对应的一级分类下面

    // 优先按sortOrder排序，sortOrder相同按照id排序
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

  /**
   * 获取分类图标库
   * @returns 预选分类图标
   */
  async findAllIcons(): Promise<CategoryIconEntity[]> {
    try {
      // 只需要iconKey和背景色
      return await this.categoryIconEntity.find({
        select: {
          iconKey: true,
          backgroundColor: true,
        },
      });
    } catch {
      throw new InternalServerErrorException('加载图标库失败，请重试');
    }
  }

  /**
   * 创建分类
   * @param userId 用户id
   * @param type 分类类型
   * @param name 分类名称
   * @param iconKey 分类iconKey
   * @param parentId 父级分类id
   */
  async create(
    userId: number,
    type: AmountType,
    name: string,
    iconKey: IconKey,
    parentId?: number | null,
  ): Promise<void> {
    // 解析分类等级
    const level = parentId ? 2 : 1;

    // 收入分类只允许创建一级分类
    if (type === AmountType.INCOME && parentId)
      throw new BadRequestException('收入只允许创建一级分类');

    // 创建二级分类时，父分类必须存在、未归档、属于一级分类、父子分类type必须相同
    if (parentId) {
      // 查询父分类是否存在
      const result = await this.userCategoryRepo.findOneBy({
        ownerUserId: userId,
        id: parentId,
        level: 1,
        type,
        archivedTime: IsNull(),
      });

      if (!result)
        throw new BadRequestException(
          '创建二级分类时，父分类必须存在、未归档、属于一级分类、父子分类类型必须相同',
        );
    }

    const parentIdCondition = parentId ? { parentId } : { parentId: IsNull() };

    // 检查同一归属下有没有同名的分类
    const haveSame = await this.userCategoryRepo.findOneBy({
      ownerUserId: userId,
      name,
      ...parentIdCondition,
      type,
      archivedTime: IsNull(),
    });
    if (haveSame) throw new BadRequestException('已经存在相同的分类');

    try {
      // 获取和所添加分类同等级同归属的最后一个分类的顺序
      const result = await this.userCategoryRepo.findOne({
        select: {
          sortOrder: true,
        },
        where: {
          ownerUserId: userId,
          type,
          level,
          ...parentIdCondition,
        },
        order: {
          sortOrder: 'DESC',
        },
      });
      // 新增的分类必须放到最后
      const sortOrder = result ? result.sortOrder + 1 : 0;

      // 创建实体
      const saveData = this.userCategoryRepo.create({
        ownerUserId: userId,
        sourceTplId: null,
        type,
        parentId,
        name,
        sortOrder,
        level,
        iconKey,
      });

      // 保存数据
      await this.userCategoryRepo.save(saveData);
    } catch (error) {
      throw new InternalServerErrorException('创建分类失败，请稍后重试', {
        cause: error,
      });
    }
  }

  // bulkCreate
}
