/**
 * @author Brave
 * @date 2026-09-22 14:35:00
 * @description 分类模块控制层
 */

import { Controller, Get, Query } from '@nestjs/common';
import { UserCategoryEntity } from './entities/user-category.entity';
import { CategoriesService } from './categories.service';
import { FindUserCategory } from './dto/find-user-category.dto';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

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
  ): Promise<UserCategoryEntity[]> {
    return await this.categoriesService.findAllForUser(userId, query.type);
  }
}
