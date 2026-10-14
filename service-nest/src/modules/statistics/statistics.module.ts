/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 注册只读流水统计模块，复用既有流水、用户分类和图标实体。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionEntity])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
