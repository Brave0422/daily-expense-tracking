/** 日明细的分组、金额精度和周期统计测试。 */
import type { Repository } from 'typeorm';
import { CategoryIconEntity } from '../categories/entities/category-icon.entity';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import type { TagEntity } from '../tags/entities/tag.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionType } from './enums/transaction-type-enum';
import { TransactionsService } from './transactions.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// 与创建流水测试一致，转发 Jest 尚未映射的 src/* 模块。
jest.mock(
  'src/modules/transactions/enums/transaction-type-enum',
  () =>
    jest.requireActual<typeof import('./enums/transaction-type-enum')>(
      './enums/transaction-type-enum',
    ),
  { virtual: true },
);
jest.mock(
  'src/modules/transactions/entities/transaction-tag.entity',
  () =>
    jest.requireActual<typeof import('./entities/transaction-tag.entity')>(
      './entities/transaction-tag.entity',
    ),
  { virtual: true },
);
jest.mock(
  'src/common/util/convertAmount',
  () =>
    jest.requireActual<typeof import('../../common/util/convertAmount')>(
      '../../common/util/convertAmount',
    ),
  { virtual: true },
);
jest.mock(
  'src/common/util/common',
  () =>
    jest.requireActual<typeof import('../../common/util/common')>(
      '../../common/util/common',
    ),
  { virtual: true },
);

describe('TransactionsService.findDailyTransactions', () => {
  let service: TransactionsService;
  let findTransactions: jest.SpiedFunction<
    TransactionsService['findTransactions']
  >;

  beforeEach(() => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        total_income: '20.00',
        total_expense: '9.00',
      }),
    };
    service = new TransactionsService(
      {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      } as unknown as Repository<TransactionEntity>,
      {} as Repository<UserCategoryEntity>,
      {} as Repository<TagEntity>,
    );
    findTransactions = jest.spyOn(service, 'findTransactions');
  });

  it('按发生日期分组，保留流水顺序并精确累计每日收支', async () => {
    const primaryCategory = Object.assign(new UserCategoryEntity(), {
      id: 1,
      name: '餐饮',
      iconKey: 'food',
      icon: Object.assign(new CategoryIconEntity(), {
        backgroundColor: '#ff0000',
      }),
      archivedTime: null,
    });
    const expenseCategory = Object.assign(new UserCategoryEntity(), {
      id: 12,
      name: '午餐',
      iconKey: 'meal',
      parent: primaryCategory,
      archivedTime: null,
    });
    const incomeCategory = Object.assign(new UserCategoryEntity(), {
      ...primaryCategory,
      id: 6,
      name: '工资',
    });
    const transactions = [
      {
        id: 4,
        date: '2026-10-12',
        type: TransactionType.INCOME,
        amount: '1.23',
      },
      {
        id: 3,
        date: '2026-10-12',
        type: TransactionType.EXPENSE,
        amount: '0.2',
      },
      {
        id: 2,
        date: '2026-10-12',
        type: TransactionType.EXPENSE,
        amount: '0.1',
      },
      {
        id: 1,
        date: '2026-10-11',
        type: TransactionType.EXPENSE,
        amount: '2.5',
      },
    ].map(({ id, date, type, amount }) =>
      Object.assign(new TransactionEntity(), {
        id,
        occurredDate: date,
        type,
        amount,
        category:
          type === TransactionType.EXPENSE ? expenseCategory : incomeCategory,
      }),
    );
    findTransactions.mockResolvedValue({
      transactions,
      totalIncome: '1.23',
      totalExpense: '2.80',
    });

    const result = await service.findDailyTransactions(7, '2026-10');

    expect(result).toMatchObject({
      period: '2026-10',
      totals: { expense: '9.00', income: '20.00', balance: '11.00' },
      filterTotals: { expense: '2.80', income: '1.23' },
      days: [
        {
          date: '2026-10-12',
          expenseTotal: '0.30',
          incomeTotal: '1.23',
          transactions: [
            { id: 4, amount: '1.23', category: { secondary: null } },
            {
              id: 3,
              amount: '0.20',
              category: {
                primary: { id: 1, backgroundColor: '#ff0000' },
                secondary: { id: 12, backgroundColor: '#ff0000' },
              },
            },
            { id: 2, amount: '0.10' },
          ],
        },
        {
          date: '2026-10-11',
          expenseTotal: '2.50',
          incomeTotal: '0.00',
          transactions: [{ id: 1, amount: '2.50' }],
        },
      ],
    });
  });

  it('转发所有筛选条件，无匹配流水时仍返回完整周期统计和空日分组', async () => {
    findTransactions.mockResolvedValue({
      transactions: [],
      totalIncome: '0.00',
      totalExpense: '0.00',
    });

    const result = await service.findDailyTransactions(
      7,
      '2026-10',
      TransactionType.EXPENSE,
      [12],
      [3],
      '午餐',
      '优惠',
      '1.00',
      '50.00',
    );

    expect(findTransactions).toHaveBeenCalledWith(
      7,
      TransactionType.EXPENSE,
      [12],
      [3],
      '午餐',
      '优惠',
      '1.00',
      '50.00',
      '2026-10',
    );
    expect(result).toEqual({
      period: '2026-10',
      totals: { expense: '9.00', income: '20.00', balance: '11.00' },
      filterTotals: { expense: '0.00', income: '0.00' },
      days: [],
    });
  });
});
