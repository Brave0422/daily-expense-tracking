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
import { IsNull, Not, Repository, Raw } from 'typeorm';
import type { TagListItem } from './types/tag.types';
import {
  LIKE_ESCAPE_CHARACTER,
  escapeLikePattern,
} from '../../common/util/escapeLikePattern';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepo: Repository<TagEntity>,
  ) {}

  /**
   * 通过id判断标签是否存在
   * @param id 标签id
   * @param userId 用户id
   * @returns
   */
  private async assertExistsById(id: number, userId: number): Promise<void> {
    const result = await this.tagRepo.existsBy({
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
   * @param name 标签名称
   * @param userId 用户id
   * @param excludedId 编辑时需要排除的标签id
   */
  private async checkSameName(
    name: string,
    userId: number,
    excludedId?: number,
  ): Promise<void> {
    const result = await this.tagRepo.existsBy({
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
   * 获取用户所有标签
   * @param userId 用户id
   * @returns 用户标签列表
   */
  async findAllByUser(userId: number): Promise<TagListItem[]> {
    try {
      return await this.tagRepo.find({
        select: {
          id: true,
          name: true,
        },
        where: {
          ownerUserId: userId,
          archivedTime: IsNull(),
        },
        order: {
          updatedTime: 'DESC',
          id: 'DESC',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('获取用户标签失败，请重新获取', {
        cause: error,
      });
    }
  }

  /**
   * 创建标签
   * @param userId 用户id
   * @param name 标签名称
   */
  async create(userId: number, name: string): Promise<void> {
    await this.checkSameName(name, userId);

    try {
      // 创建标签数据
      const entity = this.tagRepo.create({
        ownerUserId: userId,
        name,
      });

      await this.tagRepo.save(entity);
    } catch (error) {
      throw new InternalServerErrorException('创建标签失败，请重新尝试', {
        cause: error,
      });
    }
  }

  /**
   * 编辑标签
   * @param id 标签id
   * @param userId 用户id
   * @param name 标签名称
   */
  async update(id: number, userId: number, name: string): Promise<void> {
    await this.assertExistsById(id, userId);
    await this.checkSameName(name, userId, id);

    try {
      // 更新标签时再次限定所属用户和归档状态，避免并发状态变化导致越界更新。
      const result = await this.tagRepo.update(
        { id, ownerUserId: userId, archivedTime: IsNull() },
        { name },
      );

      if (result.affected !== 1) {
        throw new InternalServerErrorException('编辑标签失败，请重新尝试');
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('编辑标签失败，请重新尝试', {
        cause: error,
      });
    }
  }

  /**
   * 删除标签
   * @param id 标签id
   * @param userId 用户id
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
