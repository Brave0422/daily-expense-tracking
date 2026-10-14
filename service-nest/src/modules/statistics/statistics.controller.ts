/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 六个独立统计 GET 入口，从认证上下文获取用户并严格校验查询 DTO。
 */
import { Controller, Get } from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import {
  MonthlyCategoryRankingQueryDto,
  YearlyCategoryRankingQueryDto,
  MonthlyCategoryStatisticsQueryDto,
  YearlyCategoryStatisticsQueryDto,
  MonthlyTransactionTrendQueryDto,
  YearlyTransactionTrendQueryDto,
} from './dto/statistics-query.dto';
import { StatisticsQuery } from './statistics-query.decorator';
import { StatisticsService } from './statistics.service';
import type {
  CategoryRankingResult,
  CategoryStatisticsResult,
  TransactionTrendResult,
} from './statistics.types';

@Controller('statistics')
export class StatisticsController {
  /**
   * @param statisticsService 只读统计服务
   * @returns 初始化完成的控制层
   */
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * 查询月分类排行，沿用项目统一响应包装。
   * @param userId 认证用户 ID，不由客户端提交
   * @param query 严格校验的月份、类型、层级和排序
   * @returns 异步返回整月有效分类排行
   * @throws BadRequestException 缺失、非法或额外查询字段
   */
  @Get('category-ranking/monthly')
  findMonthlyCategoryRanking(
    @CurrentUserId() userId: number,
    @StatisticsQuery() query: MonthlyCategoryRankingQueryDto,
  ): Promise<CategoryRankingResult> {
    return this.statisticsService.findMonthlyCategoryRanking(
      userId,
      query.month,
      query.type,
      query.categoryLevel,
      query.order,
    );
  }
  /**
   * 查询年分类排行。
   * @param userId 认证用户 ID
   * @param query 年份、类型、层级和排序
   * @returns 异步返回全年有效分类排行
   * @throws BadRequestException 缺失、非法或额外查询字段
   */
  @Get('category-ranking/yearly')
  findYearlyCategoryRanking(
    @CurrentUserId() userId: number,
    @StatisticsQuery() query: YearlyCategoryRankingQueryDto,
  ): Promise<CategoryRankingResult> {
    return this.statisticsService.findYearlyCategoryRanking(
      userId,
      query.year,
      query.type,
      query.categoryLevel,
      query.order,
    );
  }
  /**
   * 查询月分类占比，不接收排序参数。
   * @param userId 认证用户 ID
   * @param query 月份、类型和层级
   * @returns 异步返回整月有效分类金额与占比
   * @throws BadRequestException 缺失、非法或额外查询字段
   */
  @Get('category-proportion/monthly')
  findMonthlyCategoryProportion(
    @CurrentUserId() userId: number,
    @StatisticsQuery() query: MonthlyCategoryStatisticsQueryDto,
  ): Promise<CategoryStatisticsResult> {
    return this.statisticsService.findMonthlyCategoryProportion(
      userId,
      query.month,
      query.type,
      query.categoryLevel,
    );
  }
  /**
   * 查询年分类占比。
   * @param userId 认证用户 ID
   * @param query 年份、类型和层级
   * @returns 异步返回全年有效分类金额与占比
   * @throws BadRequestException 缺失、非法或额外查询字段
   */
  @Get('category-proportion/yearly')
  findYearlyCategoryProportion(
    @CurrentUserId() userId: number,
    @StatisticsQuery() query: YearlyCategoryStatisticsQueryDto,
  ): Promise<CategoryStatisticsResult> {
    return this.statisticsService.findYearlyCategoryProportion(
      userId,
      query.year,
      query.type,
      query.categoryLevel,
    );
  }
  /**
   * 查询月趋势，不接收分类或排序条件。
   * @param userId 认证用户 ID
   * @param query 月份和流水类型
   * @returns 异步返回完整每日时间轴和整月比较
   * @throws BadRequestException 缺失、非法或额外查询字段
   */
  @Get('transaction-trend/monthly')
  findMonthlyTransactionTrend(
    @CurrentUserId() userId: number,
    @StatisticsQuery() query: MonthlyTransactionTrendQueryDto,
  ): Promise<TransactionTrendResult> {
    return this.statisticsService.findMonthlyTransactionTrend(
      userId,
      query.month,
      query.type,
    );
  }
  /**
   * 查询年趋势。
   * @param userId 认证用户 ID
   * @param query 年份和流水类型
   * @returns 异步返回十二个月时间轴和整年比较
   * @throws BadRequestException 缺失、非法或额外查询字段
   */
  @Get('transaction-trend/yearly')
  findYearlyTransactionTrend(
    @CurrentUserId() userId: number,
    @StatisticsQuery() query: YearlyTransactionTrendQueryDto,
  ): Promise<TransactionTrendResult> {
    return this.statisticsService.findYearlyTransactionTrend(
      userId,
      query.year,
      query.type,
    );
  }
}
