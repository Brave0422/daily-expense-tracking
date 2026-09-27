/**
 * @author Brave
 * @date 2026-09-27 11:09:52
 * @description 金额标签模块
 */

import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagEntity } from './entities/tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TagEntity])],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
