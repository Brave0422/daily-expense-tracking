/**
 * @author Brave
 * @date 2026-09-30 09:52:23
 * @description 流水控制层
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseMsg } from '../../common/decorators/response-message.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionIdParamDto } from './dto/transaction-id-param.dto';
import { DailyTransactionsQueryDto } from './dto/daily-transaction-query.dto';
import {
  DailyTransactionsResult,
  MonthlySummaryResult,
} from './interfaces/transaction-result';
import { TransactionsService } from './transactions.service';
import { MonthlySummaryQueryDto } from './dto/monthly-summary-query.dto';
@Controller('transactions')
export class TransactionsController {
  /**
   * 初始化 TransactionsController 的依赖。
   *
   * @param transactionsService 处理流水查询及写入的业务服务
   */
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * 删除当前用户的流水，并归档没有其他有效流水引用的标签。
   * @param userId 当前登录用户id，由认证上下文提供
   * @param params 已通过正整数校验的流水路径参数
   * @returns 删除完成后无响应数据，由客户端重新查询账单
   */
  @Delete(':id/archive')
  @ResponseMsg('删除流水成功')
  archive(
    @CurrentUserId() userId: number,
    @Param() params: TransactionIdParamDto,
  ): Promise<void> {
    return this.transactionsService.archive(userId, params.id);
  }

  /**
   * 创建当前用户的流水及标签关联，完成后由客户端重新查询账单。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param body 包含类型、分类、金额、发生日期及可选文本和标签的创建请求
   * @returns 流水创建完成后异步结束，无响应数据
   */
  @Post()
  @ResponseMsg('创建流水成功')
  create(
    @CurrentUserId() userId: number,
    @Body() body: CreateTransactionDto,
  ): Promise<void> {
    const {
      type,
      categoryId,
      amount,
      occurredDate,
      title,
      tagIds,
      remark,
      tagNames,
      tagUpdates,
    } = body;
    return this.transactionsService.createTransaction(
      userId,
      type,
      categoryId,
      amount,
      occurredDate,
      title,
      tagIds,
      remark,
      tagNames,
      ...(tagUpdates ? [tagUpdates] : []),
    );
  }

  /**
   * 完整提交六个可编辑字段，流水类型保持创建时的值。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param params 包含已通过正整数校验的流水id的路径参数
   * @param body 包含分类、金额、发生日期、标题、完整标签集合和备注的编辑请求
   * @returns 流水及标签更新完成后异步结束，无响应数据
   */
  @Patch(':id')
  @ResponseMsg('编辑流水成功')
  update(
    @CurrentUserId() userId: number,
    @Param() params: TransactionIdParamDto,
    @Body() body: UpdateTransactionDto,
  ): Promise<void> {
    const {
      categoryId,
      amount,
      occurredDate,
      title,
      tagIds,
      remark,
      tagNames,
      tagUpdates,
    } = body;
    return this.transactionsService.updateTransaction(
      userId,
      params.id,
      categoryId,
      amount,
      occurredDate,
      title,
      tagIds,
      remark,
      tagNames,
      ...(tagUpdates ? [tagUpdates] : []),
    );
  }

  /**
   * 获取每日流水详情，以一个自然月为查询周期。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param query 包含月份及收支类型、分类、标签、文本和金额区间的查询参数
   * @returns 查询月份、完整月总览、筛选合计及按日期分组的流水明细
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
   * 获取每月流水汇总，以一个自然年为查询周期。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param query 包含年份及收支类型、分类和金额区间的查询参数
   * @returns 查询年份、完整年总览、筛选合计及按月份和分类分组的汇总
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
