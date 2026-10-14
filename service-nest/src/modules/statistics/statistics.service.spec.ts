/**
 * @author Brave
 * @date 2026-10-14T12:48:33+08:00
 * @description 统计聚合精度、排序、时间补零、归档用户隔离条件及比较边界测试。
 */
import type { Repository } from 'typeorm';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { TransactionType } from '../transactions/enums/transaction-type-enum';
import { StatisticsService } from './statistics.service';
import {
  calculatePercentage,
  createStatisticsTimeline,
  getStatisticsRange,
} from './statistics.util';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock(
  'src/modules/transactions/enums/transaction-type-enum',
  () =>
    jest.requireActual<
      typeof import('../transactions/enums/transaction-type-enum')
    >('../transactions/enums/transaction-type-enum'),
  { virtual: true },
);
jest.mock(
  'src/modules/transactions/entities/transaction-tag.entity',
  () =>
    jest.requireActual<
      typeof import('../transactions/entities/transaction-tag.entity')
    >('../transactions/entities/transaction-tag.entity'),
  { virtual: true },
);

/**
 * @returns 可设置原始聚合结果的统计服务及可检查 SQL 条件的查询构造器
 */
function createService() {
  const query = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn<Promise<unknown[]>, []>().mockResolvedValue([]),
  };
  const repository = { createQueryBuilder: jest.fn().mockReturnValue(query) };
  return {
    service: new StatisticsService(
      repository as unknown as Repository<TransactionEntity>,
    ),
    query,
    repository,
  };
}
describe('StatisticsService', () => {
  it('按精确金额排序，同金额按 ID 升序，同名分类不合并，且继承父分类信息', async () => {
    const { service, query, repository } = createService();
    const rows = [
      {
        categoryId: 15,
        name: '其他',
        iconKey: 'food',
        backgroundColor: '#22C55E',
        parentId: 1,
        parentName: '三餐',
        amount: '10.00',
        transactionCount: '2',
      },
      {
        categoryId: 11,
        name: '其他',
        iconKey: 'food',
        backgroundColor: '#22C55E',
        parentId: 2,
        parentName: '零食',
        amount: '10.00',
        transactionCount: '1',
      },
      {
        categoryId: 12,
        name: '午餐',
        iconKey: 'food',
        backgroundColor: '#22C55E',
        parentId: 1,
        parentName: '三餐',
        amount: '2.00',
        transactionCount: '3',
      },
    ];
    query.getRawMany.mockResolvedValue(rows);
    const descending = await service.findMonthlyCategoryRanking(
      7,
      '2026-10',
      TransactionType.EXPENSE,
      2,
      'desc',
    );
    expect(descending).toMatchObject({
      totalAmount: '22.00',
      transactionCount: 6,
      order: 'desc',
    });
    expect(descending.items.map((item) => item.categoryId)).toEqual([
      11, 15, 12,
    ]);
    expect(descending.items[0]).toMatchObject({
      parent: { categoryId: 2, name: '零食' },
      percentage: '45.45',
    });
    const ascending = await service.findMonthlyCategoryRanking(
      7,
      '2026-10',
      TransactionType.EXPENSE,
      2,
      'asc',
    );
    expect(ascending.items.map((item) => item.categoryId)).toEqual([
      12, 11, 15,
    ]);
    const proportion = await service.findMonthlyCategoryProportion(
      7,
      '2026-10',
      TransactionType.EXPENSE,
      2,
    );
    expect(proportion.items).toEqual(descending.items);
    expect(proportion.totalAmount).toBe(descending.totalAmount);
    expect(proportion.transactionCount).toBe(descending.transactionCount);
    expect(proportion).not.toHaveProperty('order');
    // 单一聚合查询生成完整响应，不查询单笔流水或标签、不另查一次总额。
    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(query.leftJoin).toHaveBeenCalledWith('parent.icon', 'parentIcon');
  });
  it('金额累计超过 JS 安全整数也保持最后一分和正确百分比', async () => {
    const { service, query } = createService();
    query.getRawMany.mockResolvedValue([
      {
        categoryId: 1,
        name: '工资',
        iconKey: 'salary',
        backgroundColor: '#ffffff',
        parentId: null,
        parentName: null,
        amount: '90071992547409.91',
        transactionCount: '10',
      },
      {
        categoryId: 2,
        name: '奖金',
        iconKey: 'bonus',
        backgroundColor: '#ffffff',
        parentId: null,
        parentName: null,
        amount: '0.01',
        transactionCount: '1',
      },
    ]);
    const result = await service.findYearlyCategoryProportion(
      7,
      '2026',
      TransactionType.INCOME,
      1,
    );
    expect(result.totalAmount).toBe('90071992547409.92');
    expect(result.items[1]).toMatchObject({
      amount: '0.01',
      percentage: '0.00',
      parent: null,
    });
  });
  it('一级汇总选择父级 ID，基础条件统一限制归属、层级及归档，未关联标签', async () => {
    const { service, query } = createService();
    await service.findYearlyCategoryRanking(
      7,
      '2026',
      TransactionType.EXPENSE,
      1,
      'desc',
    );
    expect(query.select).toHaveBeenCalledWith('parent.id', 'categoryId');
    expect(query.where).toHaveBeenCalledWith(
      'transaction.ownerUserId = :userId',
      { userId: 7 },
    );
    for (const condition of [
      'transaction.archivedTime IS NULL',
      'category.ownerUserId = :userId',
      'category.archivedTime IS NULL',
      'parent.ownerUserId = :userId',
      'parent.archivedTime IS NULL',
      'parent.type = :type',
      'category.level = 2',
      'parent.level = 1',
    ])
      expect(query.andWhere).toHaveBeenCalledWith(condition);
    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.innerJoin).toHaveBeenCalledWith(
      'transaction.category',
      'category',
    );
  });
  it.each([
    ['0.00', '0.00', 'unchanged', '0.00'],
    ['12.00', '12.00', 'unchanged', '0.00'],
    ['12.00', '0.00', 'new', null],
    ['0.00', '12.00', 'decrease', '-100.00'],
    ['15.00', '12.00', 'increase', '25.00'],
    ['9.00', '12.00', 'decrease', '-25.00'],
    ['10000.01', '10000.00', 'increase', '0.00'],
    ['10000.00', '10000.01', 'decrease', '0.00'],
  ])(
    '本期 %s、上期 %s 的整月比较正确',
    async (current, previous, status, rate) => {
      const { service, query, repository } = createService();
      query.getRawMany.mockResolvedValue([
        ...(previous === '0.00'
          ? []
          : [{ date: '2025-12-31', amount: previous, transactionCount: '2' }]),
        ...(current === '0.00'
          ? []
          : [{ date: '2026-01-31', amount: current, transactionCount: '3' }]),
      ]);
      const result = await service.findMonthlyTransactionTrend(
        7,
        '2026-01',
        TransactionType.EXPENSE,
      );
      expect(result).toMatchObject({
        totalAmount: current,
        previousTotalAmount: previous,
        previousPeriod: '2025-12',
        changeStatus: status,
        changeRate: rate,
      });
      expect(result.series).toHaveLength(31);
      expect(result.series[0]).toEqual({ date: '2026-01-01', amount: '0.00' });
      expect(result.series[30]).toEqual({
        date: '2026-01-31',
        amount: current,
      });
      expect(query.andWhere).toHaveBeenCalledWith(
        'transaction.occurredDate >= :start AND transaction.occurredDate < :end',
        { start: '2025-12-01', end: '2026-02-01' },
      );
      expect(query.andWhere).toHaveBeenCalledWith(
        'parent.archivedTime IS NULL',
      );
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    },
  );
  it('收入趋势只查询有效一级收入，年轴补齐十二个月', async () => {
    const { service, query } = createService();
    query.getRawMany.mockResolvedValue([
      { date: '2025-12', amount: '80.00', transactionCount: 2 },
      { date: '2026-02', amount: '100.00', transactionCount: 4 },
    ]);
    const result = await service.findYearlyTransactionTrend(
      7,
      '2026',
      TransactionType.INCOME,
    );
    expect(result.series).toHaveLength(12);
    expect(result.series[1]).toEqual({ date: '2026-02', amount: '100.00' });
    expect(result).toMatchObject({
      totalAmount: '100.00',
      transactionCount: 4,
      previousTotalAmount: '80.00',
      changeRate: '25.00',
    });
    expect(query.andWhere).toHaveBeenCalledWith('category.level = 1');
    expect(query.andWhere).toHaveBeenCalledWith('category.parentId IS NULL');
  });
  it('空分类返回完整结构，收入二级在查询前拒绝', async () => {
    const { service, repository } = createService();
    expect(
      await service.findMonthlyCategoryProportion(
        7,
        '2026-10',
        TransactionType.EXPENSE,
        2,
      ),
    ).toEqual({
      period: '2026-10',
      periodType: 'month',
      type: 'expense',
      categoryLevel: 2,
      totalAmount: '0.00',
      transactionCount: 0,
      items: [],
    });
    await expect(
      service.findYearlyCategoryProportion(
        7,
        '2026',
        TransactionType.INCOME,
        2,
      ),
    ).rejects.toThrow('收入只支持一级分类统计');
    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
});
describe('自然周期与精确百分比', () => {
  it.each([
    ['2026-02', 28],
    ['2024-02', 29],
    ['2000-02', 29],
    ['2100-02', 28],
    ['2026-04', 30],
    ['2026-10', 31],
  ])('%s 补齐 %s 天', (period, days) => {
    const axis = createStatisticsTimeline(getStatisticsRange(period, 'month'));
    expect(axis).toHaveLength(days);
    expect(axis.at(-1)).toBe(`${period}-${days}`);
  });
  it('四舍五入百分比并规范负零', () => {
    expect(calculatePercentage(1n, 3n)).toBe('33.33');
    expect(calculatePercentage(2n, 3n)).toBe('66.67');
    expect(calculatePercentage(1n, 20000n)).toBe('0.01');
    expect(calculatePercentage(-1n, 1000000n)).toBe('0.00');
  });
});
