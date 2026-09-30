/**
 * @author Brave
 * @date 2026-09-22 14:33:12
 * @description 分类模块
 */

import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryTemplateEntity } from './entities/category-template.entity';
import { UserCategoryEntity } from './entities/user-category.entity';
import { CategoryIconEntity } from './entities/category-icon.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryTemplateEntity,
      UserCategoryEntity,
      CategoryIconEntity,
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
