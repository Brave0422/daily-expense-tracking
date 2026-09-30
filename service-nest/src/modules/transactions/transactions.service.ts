/**
 * @author Brave
 * @date 2026-09-30 09:51:25
 * @description 流水服务层
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { In, Repository } from 'typeorm';
import { TransactionType } from './enums/transaction-type-enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(TransactionEntity)
    private readonly transactionEntity: Repository<TransactionEntity>,
  ) {}

  async findDailyTxn(
    userId: number,
    type?: TransactionType,
    categoryIds?: number[],
    tagIds?: [],
    title?: string,
    remark?: string,
    minAmount?: number,
    maxAmount?: number,
  ) {
    // 构建条件
    const typeCondition = type ? { type } : {};

    const categoryIdsCondition =
      categoryIds && categoryIds.length > 0
        ? { categoryId: In(categoryIds) }
        : {};

    
  }
}
