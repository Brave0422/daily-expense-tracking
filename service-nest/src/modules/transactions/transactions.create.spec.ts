/** 创建流水的业务规则与事务边界测试。 */
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import { TagEntity } from '../tags/entities/tag.entity';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionType } from './enums/transaction-type-enum';
import { TransactionsService } from './transactions.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// 现有 Jest 配置未映射 src/* 路径；使用真实模块转发，保持金额工具与实体不变。
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

describe('TransactionsService.createTransaction', () => {
  let categoryRepo: { findOne: jest.Mock };
  let tagRepo: { find: jest.Mock };
  let transactionRepo: { create: jest.Mock; save: jest.Mock };
  let transactionTagRepo: { create: jest.Mock; save: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let runTransaction: jest.Mock;
  let service: TransactionsService;

  beforeEach(() => {
    categoryRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 12,
        ownerUserId: 7,
        type: TransactionType.EXPENSE,
        level: 2,
        archivedTime: null,
      }),
    };
    tagRepo = {
      find: jest.fn().mockResolvedValue([{ id: 3 }, { id: 5 }]),
    };
    transactionRepo = {
      create: jest.fn((data: DeepPartial<TransactionEntity>) => data),
      save: jest.fn((data: DeepPartial<TransactionEntity>) =>
        Promise.resolve({ ...data, id: 101 }),
      ),
    };
    transactionTagRepo = {
      create: jest.fn((data: DeepPartial<TransactionTagEntity>) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };

    // 只有事务 manager 提供写入仓库，确保实现不会绕过当前事务使用注入仓库。
    const repositories = new Map<unknown, unknown>([
      [UserCategoryEntity, categoryRepo],
      [TagEntity, tagRepo],
      [TransactionEntity, transactionRepo],
      [TransactionTagEntity, transactionTagRepo],
    ]);
    manager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    runTransaction = jest.fn(
      (callback: (manager: EntityManager) => Promise<void>) =>
        callback(manager as unknown as EntityManager),
    );
    service = new TransactionsService(
      {
        manager: { transaction: runTransaction },
      } as unknown as Repository<TransactionEntity>,
      {} as Repository<UserCategoryEntity>,
      {} as Repository<TagEntity>,
    );
  });

  it('在同一事务中保存流水和去重后的已有标签关联，不返回流水数据', async () => {
    await expect(
      service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        '17.2',
        '2026-10-11',
        '  午餐  ',
        [3, 5, 3],
        '  使用优惠券  ',
      ),
    ).resolves.toBeUndefined();

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(categoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 12, ownerUserId: 7, archivedTime: IsNull() },
      lock: { mode: 'pessimistic_read' },
    });
    expect(tagRepo.find).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: In([3, 5]), ownerUserId: 7, archivedTime: IsNull() },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    expect(transactionRepo.create).toHaveBeenCalledWith({
      ownerUserId: 7,
      type: TransactionType.EXPENSE,
      categoryId: 12,
      amount: '17.20',
      occurredDate: '2026-10-11',
      title: '午餐',
      remark: '使用优惠券',
      archivedTime: null,
    });
    expect(transactionTagRepo.save).toHaveBeenCalledWith([
      { transactionId: 101, tagId: 3 },
      { transactionId: 101, tagId: 5 },
    ]);
    expect(transactionRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
      transactionTagRepo.save.mock.invocationCallOrder[0],
    );
  });

  it.each([undefined, []])('未选择标签（%j）时只保存流水', async (tagIds) => {
    await service.createTransaction(
      7,
      TransactionType.EXPENSE,
      12,
      '1',
      '2026-10-11',
      '   ',
      tagIds,
    );

    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '1.00', title: null, remark: null }),
    );
    expect(tagRepo.find).not.toHaveBeenCalled();
    expect(transactionTagRepo.save).not.toHaveBeenCalled();
  });

  it('允许收入一级分类和闰年日期，并精确保留最大金额', async () => {
    categoryRepo.findOne.mockResolvedValue({
      type: TransactionType.INCOME,
      level: 1,
    });

    await service.createTransaction(
      7,
      TransactionType.INCOME,
      12,
      '9999999999999.99',
      '2024-02-29',
    );

    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TransactionType.INCOME,
        amount: '9999999999999.99',
        occurredDate: '2024-02-29',
      }),
    );
  });

  it('允许最小正金额，空备注和未提供的标题保存为NULL', async () => {
    await service.createTransaction(
      7,
      TransactionType.EXPENSE,
      12,
      '0.01',
      '2026-10-11',
      undefined,
      [],
      '  ',
    );

    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '0.01', title: null, remark: null }),
    );
  });

  it.each([
    '0',
    '0.00',
    '-1.00',
    '1.001',
    '10000000000000',
    '1e2',
    'NaN',
    '01.00',
    ' 1.00 ',
    '1.00\n',
    '',
    1,
    null,
  ])('拒绝非法金额 %j，且不开启事务', async (amount) => {
    await expect(
      service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        amount as string,
        '2026-10-11',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    '2026-02-29',
    '2026-02-30',
    '2026-04-31',
    '2026-13-01',
    '2026-10-00',
    '2026-1-01',
    '2026-10-11T12:00:00Z',
    '0000-01-01',
    '0999-12-31',
    '',
    null,
  ])('拒绝非法发生日期 %j，且不保存流水', async (occurredDate) => {
    await expect(
      service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        '1.00',
        occurredDate as string,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    [TransactionType.EXPENSE, TransactionType.EXPENSE, 1],
    [TransactionType.EXPENSE, TransactionType.INCOME, 1],
    [TransactionType.INCOME, TransactionType.INCOME, 2],
    [TransactionType.INCOME, TransactionType.EXPENSE, 2],
  ])(
    '拒绝类型或层级不符的分类（%s / %s / %s）',
    async (type, categoryType, level) => {
      categoryRepo.findOne.mockResolvedValue({ type: categoryType, level });

      await expect(
        service.createTransaction(7, type, 12, '1.00', '2026-10-11'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(transactionRepo.save).not.toHaveBeenCalled();
    },
  );

  it('分类不属于当前用户、不存在或已归档时拒绝创建并保留400错误', async () => {
    categoryRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        '1.00',
        '2026-10-11',
      ),
    ).rejects.toThrow('分类不存在或已归档');

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('任一标签不可用时拒绝创建，不留下未绑定完整标签的流水', async () => {
    tagRepo.find.mockResolvedValue([{ id: 3 }]);

    await expect(
      service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        '1.00',
        '2026-10-11',
        undefined,
        [3, 5],
      ),
    ).rejects.toThrow('标签不存在或已归档');

    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(transactionTagRepo.save).not.toHaveBeenCalled();
  });

  it.each([[0], [-1], [1.5], ['3'], null, '3'])(
    '拒绝非法标签id集合 %j',
    async (tagIds) => {
      await expect(
        service.createTransaction(
          7,
          TransactionType.EXPENSE,
          12,
          '1.00',
          '2026-10-11',
          undefined,
          tagIds as number[],
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(runTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['标'.repeat(51), undefined],
    [undefined, '注'.repeat(101)],
    [123, undefined],
    [undefined, 123],
  ])('拒绝超长或非字符串标题、备注', async (title, remark) => {
    await expect(
      service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        '1.00',
        '2026-10-11',
        title as string | undefined,
        undefined,
        remark as string | undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(runTransaction).not.toHaveBeenCalled();
  });

  it.each(['category', 'transaction', 'transactionTag'])(
    '数据库%s操作失败时让异常退出事务并返回500',
    async (step) => {
      const databaseError = new Error('database unavailable');
      const fail = {
        category: categoryRepo.findOne,
        transaction: transactionRepo.save,
        transactionTag: transactionTagRepo.save,
      }[step];
      fail.mockRejectedValue(databaseError);

      const result = service.createTransaction(
        7,
        TransactionType.EXPENSE,
        12,
        '1.00',
        '2026-10-11',
        undefined,
        [3, 5],
      );

      await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(result).rejects.toThrow('创建流水失败，请重新尝试');
      await expect(result).rejects.toHaveProperty('cause', databaseError);

      // 异常必须从回调传回 TypeORM，TypeORM 才会执行回滚。
      const transactionResult = runTransaction.mock.results[0]
        .value as Promise<void>;
      await expect(transactionResult).rejects.toBe(databaseError);
      if (step !== 'transactionTag') {
        expect(transactionTagRepo.save).not.toHaveBeenCalled();
      }
    },
  );
});
