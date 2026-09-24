/**
 * @author Brave
 * @date 2026-09-22 14:35:00
 * @description 分类模块控制层
 */

import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import {
  CategoriesService,
  type UserCategoryTreeItem,
} from './categories.service';
import { FindUserCategory } from './dto/find-user-category.dto';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { CategoryIconEntity } from './entities/category-icon.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { updateCategory } from './dto/update-category.dto';
import { ResonpseMsg } from 'src/common/decorators/response-message.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * 获取用户分类列表
   * @param query dto
   * @param userId 用户ID
   * @returns 用户的分类列表
   */
  @Get('getUserCategories')
  async findAllForUser(
    @Query() query: FindUserCategory,
    @CurrentUserId() userId: number,
  ): Promise<UserCategoryTreeItem[]> {
    return await this.categoriesService.findAllForUser(userId, query.type);
  }

  /**
   * 获取分类图标库
   * @returns 预选分类图标
   */
  @Get('getAllIcons')
  async findAllIcons(): Promise<CategoryIconEntity[]> {
    return await this.categoriesService.findAllIcons();
  }

  /**
   * 创建分类
   * @param userId 用户id
   * @param body dto
   */
  @Post('createCategory')
  @ResonpseMsg('创建成功')
  async create(
    @CurrentUserId() userId: number,
    @Body() body: CreateCategoryDto,
  ): Promise<void> {
    console.log('body', body);

    const { type, name, iconKey, parentId } = body;
    await this.categoriesService.create(userId, type, name, iconKey, parentId);
  }

  /**
   * 编辑分类
   * @param userId 用户id
   * @param body dto
   */
  @Post('updateCategory')
  @ResonpseMsg('编辑成功')
  async update(
    @CurrentUserId() userId: number,
    @Body() body: updateCategory,
  ): Promise<void> {
    const { id, name, iconKey } = body;
    return await this.categoriesService.update(userId, id, name, iconKey);
  }
}
