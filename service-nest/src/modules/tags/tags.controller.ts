/**
 * @author Brave
 * @date 2026-09-27 11:10:22
 * @description 流水标签控制层
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseMsg } from '../../common/decorators/response-message.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { TagNameDto } from './dto/tag-name.dto';
import { TagsService } from './tags.service';
import type { TagListItem } from './types/tag.types';
import { SearchTagQueryDto } from './dto/search-tag.dto';
import { FindTagsDto } from './dto/find-tags.dto';
import type { TagFilterListItem } from './types/tag.types';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * 获取当前用户的标签列表
   * @param userId 当前用户id
   * @param query 标签列表查询参数
   * @returns 按更新时间倒序排列的标签列表
   */
  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Query() query: FindTagsDto,
  ): Promise<TagFilterListItem[]> {
    return this.tagsService.findAllByUser(userId, query.includeArchived);
  }

  /**
   * 创建当前用户的标签
   * @param userId 当前用户id
   * @param body 标签名称请求参数
   * @returns 创建完成后无响应数据
   */
  @Post()
  @ResponseMsg('创建成功')
  create(
    @CurrentUserId() userId: number,
    @Body() body: TagNameDto,
  ): Promise<void> {
    return this.tagsService.create(userId, body.name);
  }

  /**
   * 编辑当前用户的标签名称
   * @param userId 当前用户id
   * @param id 标签id
   * @param body 标签名称请求参数
   * @returns 编辑完成后无响应数据
   */
  @Patch(':id')
  @ResponseMsg('编辑成功')
  update(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TagNameDto,
  ): Promise<void> {
    return this.tagsService.update(id, userId, body.name);
  }

  /**
   * 逻辑归档当前用户的标签
   * @param userId 当前用户id
   * @param id 标签id
   * @returns 归档完成后无响应数据
   */
  @Delete(':id/archive')
  @ResponseMsg('删除成功')
  archive(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.tagsService.archive(id, userId);
  }

  /**
   * 搜索标签
   * @param userId 用户id
   * @param query 关键字
   * @returns 标签列表
   */
  @Get('search')
  searchByName(
    @CurrentUserId() userId: number,
    @Query() query: SearchTagQueryDto,
  ): Promise<TagListItem[]> {
    return this.tagsService.searchByName(userId, query.key);
  }
}
