/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 当前用户有效流水的分类聚合、排行、占比和完整自然周期趋势。
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { amountToCents, centsToAmount } from '../../common/util/convertAmount';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { TransactionType } from '../transactions/enums/transaction-type-enum';
import type {
  CategoryLevel,
  CategoryRankingResult,
  CategoryStatisticsResult,
  StatisticsOrder,
  TransactionTrendResult,
} from './statistics.types';
import {
  calculatePercentage,
  createStatisticsTimeline,
  getStatisticsRange,
  type StatisticsRange,
} from './statistics.util';

interface AmountAggregate {
  amount: string;
  transactionCount: string | number;
}
interface CategoryAggregate extends AmountAggregate {
  categoryId: number;
  name: string;
  iconKey: string;
  backgroundColor: string;
  parentId: number | null;
  parentName: string | null;
}
interface TimeAggregate extends AmountAggregate {
  date: string;
}

@Injectable()
export class StatisticsService {
  /**
   * 注入流水仓库，仅使用数据库聚合，不加载单笔流水或标签。
   * @param transactions 流水仓库，关联现有用户分类与图标
   * @returns 初始化完成的统计服务
   */
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactions: Repository<TransactionEntity>,
  ) {}

  /**
   * 查询完整自然月的分类金额排行。
   * @param userId 认证用户 ID
   * @param month YYYY-MM 月份
   * @param type 收入或支出
   * @param categoryLevel 汇总粒度 1 或 2，收入仅支持 1
   * @param order 金额升序或降序，同金额按 ID 升序
   * @returns 异步返回精确金额、占比、笔数和完整排行
   * @throws BadRequestException 周期或收入层级无效
   */
  async findMonthlyCategoryRanking(
    userId: number,
    month: string,
    type: TransactionType,
    categoryLevel: CategoryLevel,
    order: StatisticsOrder,
  ): Promise<CategoryRankingResult> {
    return {
      ...(await this.aggregateCategories(
        userId,
        getStatisticsRange(month, 'month'),
        type,
        categoryLevel,
        order,
      )),
      order,
    };
  }
  /**
   * 查询完整自然年的分类金额排行。
   * @param userId 认证用户 ID
   * @param year YYYY 年份
   * @param type 收入或支出
   * @param categoryLevel 汇总粒度，收入仅支持一级
   * @param order 精确金额排序方向
   * @returns 异步返回按全年合并的完整分类排行
   * @throws BadRequestException 周期或收入层级无效
   */
  async findYearlyCategoryRanking(
    userId: number,
    year: string,
    type: TransactionType,
    categoryLevel: CategoryLevel,
    order: StatisticsOrder,
  ): Promise<CategoryRankingResult> {
    return {
      ...(await this.aggregateCategories(
        userId,
        getStatisticsRange(year, 'year'),
        type,
        categoryLevel,
        order,
      )),
      order,
    };
  }
  /**
   * 查询自然月分类占比，按金额降序、ID 升序。
   * @param userId 认证用户 ID
   * @param month YYYY-MM 月份
   * @param type 收入或支出
   * @param categoryLevel 汇总粒度，收入仅支持一级
   * @returns 异步返回与同条件排行一致的分类汇总，不包含 order
   * @throws BadRequestException 周期或收入层级无效
   */
  findMonthlyCategoryProportion(
    userId: number,
    month: string,
    type: TransactionType,
    categoryLevel: CategoryLevel,
  ): Promise<CategoryStatisticsResult> {
    return this.aggregateCategories(
      userId,
      getStatisticsRange(month, 'month'),
      type,
      categoryLevel,
      'desc',
    );
  }
  /**
   * 查询自然年分类占比，整个年份合并汇总。
   * @param userId 认证用户 ID
   * @param year YYYY 年份
   * @param type 收入或支出
   * @param categoryLevel 汇总粒度，收入仅支持一级
   * @returns 异步返回全年分类汇总及两位小数占比
   * @throws BadRequestException 周期或收入层级无效
   */
  findYearlyCategoryProportion(
    userId: number,
    year: string,
    type: TransactionType,
    categoryLevel: CategoryLevel,
  ): Promise<CategoryStatisticsResult> {
    return this.aggregateCategories(
      userId,
      getStatisticsRange(year, 'year'),
      type,
      categoryLevel,
      'desc',
    );
  }
  /**
   * 查询自然月每日趋势，与上一完整自然月比较。
   * @param userId 认证用户 ID
   * @param month YYYY-MM 月份
   * @param type 收入或支出
   * @returns 异步返回完整每日轴、精确总额及上月变化
   * @throws BadRequestException 周期边界无效
   */
  findMonthlyTransactionTrend(
    userId: number,
    month: string,
    type: TransactionType,
  ): Promise<TransactionTrendResult> {
    return this.aggregateTrend(
      userId,
      getStatisticsRange(month, 'month'),
      type,
    );
  }
  /**
   * 查询自然年每月趋势，与上一完整自然年比较。
   * @param userId 认证用户 ID
   * @param year YYYY 年份
   * @param type 收入或支出
   * @returns 异步返回十二个月时间轴与上年变化
   * @throws BadRequestException 周期边界无效
   */
  findYearlyTransactionTrend(
    userId: number,
    year: string,
    type: TransactionType,
  ): Promise<TransactionTrendResult> {
    return this.aggregateTrend(userId, getStatisticsRange(year, 'year'), type);
  }

  /**
   * 创建全部统计共用的有效记录集合，排除归档记录、实际分类和支出父分类。
   * @param userId 认证用户 ID，同时约束流水、实际分类及父分类归属
   * @param type 收入或支出，分类类型须一致
   * @param start 含开始日期 YYYY-MM-DD
   * @param end 不含结束日期 YYYY-MM-DD
   * @returns 未加入任何一对多标签关联的聚合查询构造器
   */
  private createEffectiveQuery(
    userId: number,
    type: TransactionType,
    start: string,
    end: string,
  ): SelectQueryBuilder<TransactionEntity> {
    const query = this.transactions
      .createQueryBuilder('transaction')
      .innerJoin('transaction.category', 'category')
      .leftJoin('category.parent', 'parent')
      .where('transaction.ownerUserId = :userId', { userId })
      .andWhere('transaction.type = :type', { type })
      .andWhere('transaction.archivedTime IS NULL')
      .andWhere('category.ownerUserId = :userId')
      .andWhere('category.type = :type')
      .andWhere('category.archivedTime IS NULL')
      .andWhere(
        'transaction.occurredDate >= :start AND transaction.occurredDate < :end',
        { start, end },
      );
    // 支出只接受有效二级分类及自己的有效一级父分类；收入只接受有效一级分类。
    if (type === TransactionType.EXPENSE) {
      query
        .andWhere('category.level = 2')
        .andWhere('parent.level = 1')
        .andWhere('parent.parentId IS NULL')
        .andWhere('parent.ownerUserId = :userId')
        .andWhere('parent.type = :type')
        .andWhere('parent.archivedTime IS NULL');
    } else {
      query
        .andWhere('category.level = 1')
        .andWhere('category.parentId IS NULL');
    }
    return query;
  }

  /**
   * 从同一次数据库聚合结果计算总额和笔数，避免并发写入导致响应内部不一致。
   * @param rows SUM(DECIMAL) 金额及 COUNT(*) 笔数结果
   * @returns 精确整数分总额和流水记录笔数
   */
  private summarizeAmounts(rows: AmountAggregate[]): {
    cents: bigint;
    transactionCount: number;
  } {
    let cents = 0n;
    let transactionCount = 0;
    for (const row of rows) {
      cents += amountToCents(row.amount);
      transactionCount += Number(row.transactionCount);
    }
    return { cents, transactionCount };
  }

  /**
   * 在数据库按分类 ID 聚合，名称、图标和父子关系取当前配置。
   * @param userId 认证用户 ID
   * @param range 完整自然周期
   * @param type 收入或支出
   * @param categoryLevel 分类聚合粒度，不筛选某个具体分类
   * @param order 金额方向，平金额始终按 ID 升序
   * @returns 异步返回分类统计，金额和百分比均为两位小数字符串
   * @throws BadRequestException 收入请求二级分类
   */
  private async aggregateCategories(
    userId: number,
    range: StatisticsRange,
    type: TransactionType,
    categoryLevel: CategoryLevel,
    order: StatisticsOrder,
  ): Promise<CategoryStatisticsResult> {
    if (type === TransactionType.INCOME && categoryLevel !== 1) {
      throw new BadRequestException('收入只支持一级分类统计');
    }
    // SQL 字段仅由合法业务枚举选择，不拼接客户端传入的字段或排序表达式。
    const isExpense = type === TransactionType.EXPENSE;
    const selectedCategory =
      isExpense && categoryLevel === 1 ? 'parent' : 'category';
    const hasParent = isExpense && categoryLevel === 2;
    const query = this.createEffectiveQuery(
      userId,
      type,
      range.start,
      range.end,
    )
      .leftJoin(`${selectedCategory}.icon`, 'selectedIcon')
      .select(`${selectedCategory}.id`, 'categoryId')
      .addSelect(`${selectedCategory}.name`, 'name')
      .addSelect(`${selectedCategory}.iconKey`, 'iconKey');
    // 二级图标的背景色继承父级一级图标，与当前流水列表的视觉规则一致。
    if (hasParent) query.leftJoin('parent.icon', 'parentIcon');
    const background = hasParent
      ? 'parentIcon.backgroundColor'
      : 'selectedIcon.backgroundColor';
    query
      .addSelect(background, 'backgroundColor')
      .addSelect(hasParent ? 'parent.id' : 'NULL', 'parentId')
      .addSelect(hasParent ? 'parent.name' : 'NULL', 'parentName')
      .addSelect('SUM(transaction.amount)', 'amount')
      .addSelect('COUNT(*)', 'transactionCount')
      .groupBy(`${selectedCategory}.id`)
      .addGroupBy(`${selectedCategory}.name`)
      .addGroupBy(`${selectedCategory}.iconKey`)
      .addGroupBy(background);
    if (hasParent) query.addGroupBy('parent.id').addGroupBy('parent.name');
    const rows = await query.getRawMany<CategoryAggregate>();
    const { cents, transactionCount } = this.summarizeAmounts(rows);
    const sorted = rows
      .filter((row) => amountToCents(row.amount) > 0n)
      .sort((left, right) => {
        const a = amountToCents(left.amount);
        const b = amountToCents(right.amount);
        if (a === b) return Number(left.categoryId) - Number(right.categoryId);
        return (a < b ? -1 : 1) * (order === 'asc' ? 1 : -1);
      });
    return {
      period: range.period,
      periodType: range.periodType,
      type,
      categoryLevel,
      transactionCount,
      totalAmount: centsToAmount(cents),
      items:
        cents === 0n
          ? []
          : sorted.map((row) => ({
              categoryId: Number(row.categoryId),
              name: row.name,
              iconKey: row.iconKey,
              backgroundColor: row.backgroundColor,
              parent: hasParent
                ? {
                    categoryId: Number(row.parentId),
                    name: row.parentName ?? '',
                  }
                : null,
              amount: centsToAmount(amountToCents(row.amount)),
              percentage: calculatePercentage(amountToCents(row.amount), cents),
            })),
    };
  }

  /**
   * 单次查询聚合本期和上期，再分区、精确求和并补齐时间轴。
   * @param userId 认证用户 ID
   * @param range 本期与上一完整自然周期
   * @param type 收入或支出，两期使用相同有效数据条件
   * @returns 异步返回趋势；上期零而本期正数时涨幅为 null
   */
  private async aggregateTrend(
    userId: number,
    range: StatisticsRange,
    type: TransactionType,
  ): Promise<TransactionTrendResult> {
    const dateExpression =
      range.periodType === 'month'
        ? "DATE_FORMAT(transaction.occurredDate, '%Y-%m-%d')"
        : "DATE_FORMAT(transaction.occurredDate, '%Y-%m')";
    const rows = await this.createEffectiveQuery(
      userId,
      type,
      range.previousStart,
      range.end,
    )
      .select(dateExpression, 'date')
      .addSelect('SUM(transaction.amount)', 'amount')
      .addSelect('COUNT(*)', 'transactionCount')
      .groupBy(dateExpression)
      .orderBy(dateExpression, 'ASC')
      .getRawMany<TimeAggregate>();
    const currentRows = rows.filter((row) => row.date >= range.period);
    const previousRows = rows.filter((row) => row.date < range.period);
    const current = this.summarizeAmounts(currentRows);
    const previous = this.summarizeAmounts(previousRows);
    const amountsByDate = new Map(
      currentRows.map((row) => [
        row.date,
        centsToAmount(amountToCents(row.amount)),
      ]),
    );
    // 变化方向按精确金额判断；极小涨跌即使舍入为 0.00 也保留真实方向。
    const changeStatus =
      current.cents === previous.cents
        ? 'unchanged'
        : previous.cents === 0n
          ? 'new'
          : current.cents > previous.cents
            ? 'increase'
            : 'decrease';
    const changeRate =
      changeStatus === 'new'
        ? null
        : previous.cents === 0n
          ? '0.00'
          : calculatePercentage(current.cents - previous.cents, previous.cents);
    return {
      period: range.period,
      periodType: range.periodType,
      type,
      transactionCount: current.transactionCount,
      totalAmount: centsToAmount(current.cents),
      previousPeriod: range.previousPeriod,
      previousTotalAmount: centsToAmount(previous.cents),
      changeStatus,
      changeRate,
      // 无记录位置补零，包括当前周期中尚未发生流水的未来日期。
      series: createStatisticsTimeline(range).map((date) => ({
        date,
        amount: amountsByDate.get(date) ?? '0.00',
      })),
    };
  }
}
