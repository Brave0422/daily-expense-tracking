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
import { CategoryEntity } from './entities/category.entity';
import { UserCategorySortEntity } from './entities/user-category-sort.entity';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([CategoryEntity, UserCategorySortEntity]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
