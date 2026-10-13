/**
 * @author Brave
 * @date 2026-09-22 14:35:00
 * @description 分类模块控制层
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import {
  CategoriesService,
  type UserCategoryTreeItem,
} from './categories.service';
import { FindUserCategory } from './dto/find-user-category.dto';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { CategoryIconEntity } from './entities/category-icon.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { updateCategory } from './dto/update-category.dto';
import { ResponseMsg } from 'src/common/decorators/response-message.decorator';

@Controller('categories')
export class CategoriesController {
  /**
   * 初始化 CategoriesController 的依赖。
   *
   * @param categoriesService 处理用户分类查询、初始化及修改的服务
   */
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
    return await this.categoriesService.findAllForUser(
      userId,
      query.type,
      query.includeArchived,
    );
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
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param body 包含类型、名称、图标及可选父分类的创建请求
   * @returns 分类创建完成后异步结束，无响应数据
   */
  @Post('create')
  @ResponseMsg('创建成功')
  async create(
    @CurrentUserId() userId: number,
    @Body() body: CreateCategoryDto,
  ): Promise<void> {
    const { type, name, iconKey, parentId } = body;
    await this.categoriesService.create(userId, type, name, iconKey, parentId);
  }

  /**
   * 编辑分类
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param body 包含分类id、新名称和图标的编辑请求
   * @returns 分类编辑完成后异步结束，无响应数据
   */
  @Post('update')
  @ResponseMsg('编辑成功')
  async update(
    @CurrentUserId() userId: number,
    @Body() body: updateCategory,
  ): Promise<void> {
    const { id, name, iconKey } = body;
    return await this.categoriesService.update(userId, id, name, iconKey);
  }

  /**
   * 归档分类
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param id 需要归档的分类id
   * @returns 分类及需要联动的二级分类归档后异步结束，无响应数据
   */
  @Delete(':id/archive')
  @ResponseMsg('删除成功')
  async archive(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return await this.categoriesService.archive(userId, id);
  }
}
