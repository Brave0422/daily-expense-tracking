/**
 * @author Brave
 * @date 2026-09-27 11:07:42
 * @description 金额标签服务层
 */

import { Injectable } from '@nestjs/common';
import { TagEntity } from './entities/tag.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagEntity: Repository<TagEntity>,
  ) {}

  /**
   * 创建标签
   * @param userId 用户id
   * @param name 标签名称
   */
  async create(userId: number, name: string): Promise<void> {
    // 当前用户已由全局认证守卫校验，创建标签时直接使用userId设置数据归属。
  }
}
