/**
 * @author Brave
 * @date 2026-09-30 09:52:23
 * @description 流水控制层
 */

import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { DailyTransactionsQueryDto } from './dto/daily-transaction-query.dto';
import { DailyTransactionsResult } from './interfaces/transaction-result';
import { TransactionsService } from './transactions.service';
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('daily')
  findDailyTransactions(
    @CurrentUserId() userId: number,
    @Query() query: DailyTransactionsQueryDto,
  ): Promise<DailyTransactionsResult> {
    const {
      tagIds,
      title,
      remark,
      month,
      type,
      categoryIds,
      minAmount,
      maxAmount,
    } = query;

    return this.transactionsService.findDailyTransactions(
      userId,
      month,
      type,
      categoryIds,
      tagIds,
      title,
      remark,
      minAmount,
      maxAmount,
    );
  }
}
