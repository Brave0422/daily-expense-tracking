/**
 * @author Brave
 * @date 2026-09-27 11:07:42
 * @description 流水标签服务层
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { TagEntity } from './entities/tag.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsWhere,
  IsNull,
  Not,
  Repository,
  Raw,
} from 'typeorm';
import type { TagFilterListItem, TagListItem } from './types/tag.types';
import { UserEntity } from '../users/entities/user.entity';
import {
  LIKE_ESCAPE_CHARACTER,
  escapeLikePattern,
} from '../../common/util/escapeLikePattern';

@Injectable()
export class TagsService {
  /**
   * 初始化 TagsService 的依赖。
   *
   * @param tagRepo 标签实体仓库
   */
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepo: Repository<TagEntity>,
  ) {}

  /**
   * 校验当前用户的未归档标签是否存在。
   *
   * @param id 需要校验的标签id
   * @param userId 当前登录用户id，由认证上下文提供
   * @returns 标签存在时异步结束，无返回值；标签不可用时抛出异常
   */
  private async assertExistsById(
    id: number,
    userId: number,
    tagRepo = this.tagRepo,
  ): Promise<void> {
    const result = await tagRepo.existsBy({
      id,
      ownerUserId: userId,
      archivedTime: IsNull(),
    });
    if (!result) {
      throw new BadRequestException('标签不存在');
    }
  }

  /**
   * 判断是否存在同名标签
   *
   * @param name 待使用的标签名称
   * @param userId 当前登录用户id，由认证上下文提供
   * @param excludedId 编辑时排除的当前标签id；创建时不传
   * @returns 没有同名未归档标签时异步结束，无返回值；名称重复时抛出异常
   */
  private async checkSameName(
    name: string,
    userId: number,
    excludedId?: number,
    tagRepo = this.tagRepo,
  ): Promise<void> {
    const result = await tagRepo.existsBy({
      name,
      ownerUserId: userId,
      archivedTime: IsNull(),
      ...(excludedId === undefined ? {} : { id: Not(excludedId) }),
    });
    if (result) {
      throw new BadRequestException('已经存在同名标签');
    }
  }

  /**
   * 在事务内锁定当前用户，串行执行标签名称写入，避免并发创建或改名产生重名。
   * @param userId 当前登录用户id
   * @param action 获得锁后使用同一事务标签仓库执行的操作
   * @returns 操作结果；异常时回滚事务并释放锁
   */
  private async withUserTagLock<T>(
    userId: number,
    action: (tagRepo: Repository<TagEntity>) => Promise<T>,
  ): Promise<T> {
    return this.tagRepo.manager.transaction(
      'READ COMMITTED',
      async (manager: EntityManager) => {
        const user = await manager.getRepository(UserEntity).findOne({
          select: { id: true },
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new BadRequestException('用户不存在');
        return action(manager.getRepository(TagEntity));
      },
    );
  }

  /**
   * 获取用户所有标签
   * @param userId 用户id
   * @param includeArchived 是否包含已归档标签
   * @returns 用户标签列表
   */
  async findAllByUser(
    userId: number,
    includeArchived = false,
  ): Promise<TagFilterListItem[]> {
    try {
      const where: FindOptionsWhere<TagEntity> = {
        ownerUserId: userId,
      };

      // 默认只返回未归档标签；账单筛选可显式查询历史归档标签
      if (!includeArchived) {
        where.archivedTime = IsNull();
      }

      const tags = await this.tagRepo.find({
        select: {
          id: true,
          name: true,
          archivedTime: true,
          updatedTime: true,
        },
        where,
        order: {
          updatedTime: 'DESC',
          id: 'DESC',
        },
      });

      if (includeArchived) {
        tags.sort(
          (firstTag, secondTag) =>
            Number(firstTag.archivedTime !== null) -
              Number(secondTag.archivedTime !== null) ||
            secondTag.updatedTime.getTime() - firstTag.updatedTime.getTime() ||
            secondTag.id - firstTag.id,
        );
      }

      return tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        archived: tag.archivedTime !== null,
      }));
    } catch (error) {
      throw new InternalServerErrorException('获取用户标签失败，请重新获取', {
        cause: error,
      });
    }
  }

  /**
   * 创建标签
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param name 新的标签名称
   * @returns 标签创建完成后异步结束，无返回值
   */
  async create(userId: number, name: string): Promise<void> {
    try {
      await this.withUserTagLock(userId, async (tagRepo) => {
        await this.checkSameName(name, userId, undefined, tagRepo);
        const entity = tagRepo.create({ ownerUserId: userId, name });
        await tagRepo.save(entity);
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('创建标签失败，请重新尝试', {
        cause: error,
      });
    }
  }

  /**
   * 为流水草稿查询同名标签，不执行任何写入。
   * @param userId 当前登录用户id
   * @param name 已由DTO去除首尾空格并校验的标签名称
   * @returns 同名未归档标签的公开字段；不存在时返回null
   */
  async checkName(
    userId: number,
    name: string,
  ): Promise<TagFilterListItem | null> {
    try {
      const tag = await this.tagRepo.findOne({
        select: { id: true, name: true },
        where: { ownerUserId: userId, name, archivedTime: IsNull() },
      });
      return tag ? { id: tag.id, name: tag.name, archived: false } : null;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('检查标签名称失败，请重新尝试', {
        cause: error,
      });
    }
  }

  /**
   * 编辑标签
   *
   * @param id 需要编辑的标签id
   * @param userId 当前登录用户id，由认证上下文提供
   * @param name 新的标签名称
   * @returns 标签名称更新完成后异步结束，无返回值
   */
  async update(id: number, userId: number, name: string): Promise<void> {
    try {
      await this.withUserTagLock(userId, async (tagRepo) => {
        await this.assertExistsById(id, userId, tagRepo);
        await this.checkSameName(name, userId, id, tagRepo);
        // 更新时再次限定归属和归档状态，避免并发归档后仍然修改名称。
        const result = await tagRepo.update(
          { id, ownerUserId: userId, archivedTime: IsNull() },
          { name },
        );
        if (result.affected !== 1) {
          throw new InternalServerErrorException('编辑标签失败，请重新尝试');
        }
      });
    } catch (error) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('编辑标签失败，请重新尝试', {
        cause: error,
      });
    }
  }

  /**
   * 逻辑归档标签，保留其历史流水关联。
   *
   * @param id 需要归档的标签id
   * @param userId 当前登录用户id，由认证上下文提供
   * @returns 标签归档完成后异步结束，无返回值
   */
  async archive(id: number, userId: number): Promise<void> {
    await this.assertExistsById(id, userId);

    try {
      const result = await this.tagRepo.update(
        { id, ownerUserId: userId, archivedTime: IsNull() },
        {
          archivedTime: new Date(),
        },
      );

      if (result.affected !== 1) {
        throw new InternalServerErrorException('删除标签失败，请重新尝试');
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('删除标签失败，请重新尝试', {
        cause: error,
      });
    }
  }

  /**
   * 根据内容查询标签
   * @param userId 用户id
   * @param key 搜索关键字
   * @returns 标签列表
   */
  async searchByName(userId: number, key: string): Promise<TagListItem[]> {
    const escapedKey = escapeLikePattern(key);
    try {
      return await this.tagRepo.find({
        select: {
          id: true,
          name: true,
        },
        where: {
          ownerUserId: userId,
          name: Raw(
            (columnAlias) =>
              // 转义特殊字符，避免扩大搜索范围
              `${columnAlias} LIKE :tagNamePattern ESCAPE '${LIKE_ESCAPE_CHARACTER}'`,
            {
              tagNamePattern: `%${escapedKey}%`,
            },
          ),
          archivedTime: IsNull(),
        },
        order: {
          updatedTime: 'DESC',
          id: 'DESC',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('查询标签失败，请重新尝试', {
        cause: error,
      });
    }
  }
}
