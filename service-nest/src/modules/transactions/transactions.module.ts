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

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, TransactionTagEntity]),
    UsersModule,
  ],
  controllers: [TransactionsService],
  providers: [TransactionsService],
})
export class TransactionsModule {}
