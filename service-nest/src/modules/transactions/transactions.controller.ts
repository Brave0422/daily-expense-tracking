/**
 * @author Brave
 * @date 2026-09-30 09:52:23
 * @description 流水控制层
 */

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResponseMsg } from '../../common/decorators/response-message.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { DailyTransactionsQueryDto } from './dto/daily-transaction-query.dto';
import {
  DailyTransactionsResult,
  MonthlySummaryResult,
} from './interfaces/transaction-result';
import { TransactionsService } from './transactions.service';
import { MonthlySummaryQueryDto } from './dto/monthly-summary-query.dto';
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /** 创建当前登录用户的流水及标签关联，完成后由客户端重新查询账单。 */
  @Post()
  @ResponseMsg('创建流水成功')
  create(
    @CurrentUserId() userId: number,
    @Body() body: CreateTransactionDto,
  ): Promise<void> {
    const { type, categoryId, amount, occurredDate, title, tagIds, remark } =
      body;
    return this.transactionsService.createTransaction(
      userId,
      type,
      categoryId,
      amount,
      occurredDate,
      title,
      tagIds,
      remark,
    );
  }

  /**
   * 获取每日流水详情(以月为周期查询流水)
   * @param userId
   * @param query
   * @returns
   */
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

  /**
   * 获取每月流水汇总(以年为周期查询流水)
   * @param userId
   * @param query
   * @returns
   */
  @Get('monthly-summary')
  findMonthlySummary(
    @CurrentUserId() userId: number,
    @Query() query: MonthlySummaryQueryDto,
  ): Promise<MonthlySummaryResult> {
    const { type, categoryIds, minAmount, maxAmount, year } = query;

    return this.transactionsService.findMonthlySummary(
      userId,
      year,
      type,
      categoryIds,
      minAmount,
      maxAmount,
    );
  }
}
