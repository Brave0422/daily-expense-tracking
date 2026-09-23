/**
 * @author Brave
 * @date 2026-09-22 14:33:12
 * @description 分类模块
 */

import { Module } from '@nestjs/common';
import { UserModule } from '../users/users.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryTplEntity } from './entities/category-template.entity';
import { UserCategoryEntity } from './entities/user-category.entity';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([CategoryTplEntity, UserCategoryEntity]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
