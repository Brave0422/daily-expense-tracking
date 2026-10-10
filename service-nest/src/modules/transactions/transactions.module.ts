/**
 * @author Brave
 * @date 2026-09-30 09:53:20
 * @description 流水模块
 */

import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import { UsersModule } from '../users/users.module';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import { CategoryIconEntity } from '../categories/entities/category-icon.entity';
import { TagEntity } from '../tags/entities/tag.entity';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      TransactionTagEntity,
      UserCategoryEntity,
      CategoryIconEntity,
      TagEntity,
    ]),
    UsersModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
