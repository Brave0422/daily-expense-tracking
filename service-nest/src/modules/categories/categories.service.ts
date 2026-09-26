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
import { FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';
import { UserCategoryEntity } from './entities/user-category.entity';
import { CategoryIconEntity } from './entities/category-icon.entity';
import { IconKey } from './enums/icon-key-enum';

export interface UserCategoryListItem extends UserCategoryEntity {
  // 是否来源于默认分类模板
  isDefault: boolean;
  // 最终用于渲染的背景色
  backgroundColor: string;
}

export interface UserCategoryTreeItem extends UserCategoryListItem {
  // 当前一级分类下按顺序排列的二级分类
  children: UserCategoryListItem[];
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
   */
  async findAllForUser(
    userId: number,
    type: AmountType,
  ): Promise<UserCategoryTreeItem[]> {
    // 根据id查询用户
    const user = await this.userService.findeOneById(userId);

    if (!user) {
      throw new BadRequestException('用户不存在，获取分类列表失败');
    }

    // 分类列表只返回未归档分类，已归档分类仅供历史金额记录关联和内部业务读取
    const allCategories = await this.userCategoryRepo.findBy({
      ownerUserId: userId,
      type,
      archivedTime: IsNull(),
    });

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

    // 筛选一级分类并按照展示顺序排序
    const parentCategories = allCategories
      .filter((category) => category.level === 1)
      .sort(compareBySortOrder);

    // 收集一级分类使用的图标键，并通过Set去重
    const parentIconKeys = [
      ...new Set(parentCategories.map((category) => category.iconKey)),
    ];

    // 根据图标键批量查询一级分类的图标背景色；没有一级分类时不查询数据库
    const parentIcons =
      parentIconKeys.length === 0
        ? []
        : await this.categoryIconEntity.find({
            select: {
              iconKey: true,
              backgroundColor: true,
            },
            where: {
              iconKey: In(parentIconKeys),
            },
          });

    // 建立“图标键 -> 背景色”映射，方便组装分类响应时快速读取
    const backgroundColorByIconKey = new Map(
      parentIcons.map((icon) => [icon.iconKey, icon.backgroundColor]),
    );

    // 逐个组装一级分类及其二级分类的最终响应数据
    return parentCategories.map((category) => {
      // 一级分类使用自身图标在图标库中配置的背景色
      const backgroundColor = backgroundColorByIconKey.get(category.iconKey);

      // 分类关联的图标不存在时说明数据不完整，终止本次查询
      if (!backgroundColor) {
        throw new InternalServerErrorException(
          `分类 ${category.id} 关联的图标不存在`,
        );
      }

      // 二级分类继承当前一级分类的背景色，并派生默认来源标识
      const children = (childrenByParentId.get(category.id) ?? []).map(
        (child) => ({
          ...child,
          isDefault: child.sourceTplId !== null,
          backgroundColor,
        }),
      );

      // 返回一级分类、派生字段以及已经组装好的二级分类列表
      return {
        ...category,
        isDefault: category.sourceTplId !== null,
        backgroundColor,
        children,
      };
    });
  }

  /**
   * 初始化用户分类表
   * @param userId 用户id
   */
  async initUserCategory(userId: number) {
    try {
      // 按照顺序获取默认分类
      const templates = await this.categoryRepo.find({
        order: {
          level: 'ASC',
          defaultSort: 'ASC',
          id: 'ASC',
        },
      });

      // 所有一级分类
      const parentTemplates = templates.filter(
        (category) => category.level === 1,
      );

      // 所有二级分类
      const childTemplates = templates.filter(
        (category) => category.level === 2,
      );

      // 创建一级分类
      const parents = parentTemplates.map((tpl) =>
        this.userCategoryRepo.create({
          ownerUserId: userId,
          sourceTplId: tpl.id,
          type: tpl.type,
          parentId: null,
          name: tpl.name,
          sortOrder: tpl.defaultSort,
          level: 1,
          iconKey: tpl.iconKey,
        }),
      );

      // 保存一级分类
      const saveParents = await this.userCategoryRepo.save(parents);

      // 建立 模板ID -> 用户分类ID 映射。这一步的目的：
      // 用户初始化后，分类 在 user_category 中生成的新 ID 不一定是原本在category_template 中的ID，所以在 user_category 中，子类的
      // parentId 可能指向的并不是真正的父类id，这里建立映射，让user_category中的parentId正确指向其父类在user_category中的id，避免错乱问题
      const userCategoryIdByTplId = new Map<number, number>(
        saveParents.map((category) => [category.sourceTplId!, category.id]),
      );

      // 创建二级分类
      const children = childTemplates.map((category) => {
        // 通过映射获取二级分类的父类id
        const parentId = userCategoryIdByTplId.get(category.parentId!);

        if (!parentId) {
          throw new InternalServerErrorException(
            `分类模板 ${category.id} 的父模板不存在`,
          );
        }

        return this.userCategoryRepo.create({
          ownerUserId: userId,
          sourceTplId: category.id,
          type: category.type,
          parentId,
          name: category.name,
          sortOrder: category.defaultSort,
          level: 2,
          iconKey: category.iconKey,
        });
      });

      // 保存二级分类
      await this.userCategoryRepo.save(children);
    } catch {
      throw new InternalServerErrorException('初始化用户失败，请稍后再试');
    }
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
        order: {
          defaultSort: 'ASC',
          iconKey: 'ASC',
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
    parentId: number | null = null,
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
    await this.checkSameName(userId, name, parentId, type);

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

  /**
   * 检查同一归属有没有同名分类
   * @param ownerUserId 用户id
   * @param name 分类名称
   * @param parentIdCondition 父级分类动态条件
   * @param type 分类类型
   * @param id 分类id，编辑时需要传递用来排除当前分类
   */
  async checkSameName(
    ownerUserId: number,
    name: string,
    parentId: number | null,
    type: AmountType,
    id: number | null = null,
  ): Promise<void> {
    // 构建parentId查询条件
    const parentIdCondition: FindOptionsWhere<UserCategoryEntity> = parentId
      ? { parentId }
      : { parentId: IsNull() };

    // 构建id查询条件
    const idCondition: FindOptionsWhere<UserCategoryEntity> = id
      ? { id: Not(id) }
      : {};

    const haveSame = await this.userCategoryRepo.findOneBy({
      ownerUserId,
      name,
      ...parentIdCondition,
      type,
      archivedTime: IsNull(),
      ...idCondition,
    });
    if (haveSame) throw new BadRequestException('已经存在相同的分类');
  }

  /**
   * 编辑分类
   * @param userId 用户id
   * @param id 分类id
   * @param name 分类新名称
   * @param iconKey 分类新图标
   */
  async update(
    userId: number,
    id: number,
    name: string,
    iconKey: IconKey,
  ): Promise<void> {
    const findRes = await this.findCategoryById(userId, id, '编辑的分类不存在');

    // 检查同一归属下，新名称的分类是否存在
    await this.checkSameName(userId, name, findRes.parentId, findRes.type, id);

    // 更新分类
    const result = await this.userCategoryRepo.update(
      { id, ownerUserId: userId },
      { name, iconKey },
    );

    if (result.affected !== 1) {
      throw new InternalServerErrorException('编辑失败，请重试');
    }
  }

  /**
   * 通过分类id查询分类
   * @param ownerUserId 用户id
   * @param id 分类id
   * @param msg 异常信息
   */
  private async findCategoryById(
    ownerUserId: number,
    id: number,
    msg: string,
  ): Promise<UserCategoryEntity> {
    // 查询对应的分类
    const result = await this.userCategoryRepo.findOneBy({
      ownerUserId,
      id,
      archivedTime: IsNull(),
    });

    if (!result) throw new BadRequestException(msg);

    return result;
  }

  /**
   * 归档分类
   * @param userId 用户id
   * @param id 分类id
   */
  async archive(userId: number, id: number): Promise<void> {
    // 查询对应分类
    const findRes = await this.findCategoryById(userId, id, '分类不存在');

    // 如果归档的是一级分类且它存在未归档的二级分类，拒绝归档
    if (findRes.level === 1) {
      // 查询它的二级分类
      const children = await this.userCategoryRepo.findBy({
        parentId: findRes.id,
        ownerUserId: findRes.ownerUserId,
        archivedTime: IsNull(),
      });

      // 存在二级分类拒绝归档
      if (children.length > 0) {
        throw new BadRequestException(
          '被删除分类存在二级分类，请先删除其二级分类',
        );
      }
    }

    // 归档
    const result = await this.userCategoryRepo.update(
      {
        id,
        ownerUserId: userId,
        archivedTime: IsNull(),
      },
      {
        archivedTime: new Date(),
      },
    );

    if (result.affected !== 1) {
      throw new InternalServerErrorException('删除失败，请重试');
    }
  }
}
