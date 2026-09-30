/**
 * @author Brave
 * @date 2026-09-30 09:51:25
 * @description 流水服务层
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { Repository } from 'typeorm';
import { TransactionType } from './enums/transaction-type-enum';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionEntity: Repository<TransactionEntity>,
  ) {}

  async findDailyTxn(
    type?: TransactionType,
    categoryIds?: number[],
    tagIds?: [],
    title?: string,
    remark?: string,
    minAmount?: number,
    maxAmount?: number,
  ) {}
}
