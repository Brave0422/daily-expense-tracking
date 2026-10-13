/**
 * @author Brave
 * @date 2026-10-13T15:41:08+08:00
 * @description 编辑流水的归属、标签草稿持久化、归档关联与事务失败测试。
 */
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import { TagEntity } from '../tags/entities/tag.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionType } from './enums/transaction-type-enum';
import { TransactionsService } from './transactions.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// 与创建测试保持一致，转发真实模块以兼容当前 Jest 的 src/* 路径配置。
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

describe('TransactionsService.updateTransaction', () => {
  let categoryRepo: { findOne: jest.Mock };
  let tagRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let transactionRepo: { findOne: jest.Mock; update: jest.Mock };
  let transactionTagRepo: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let runTransaction: jest.Mock;
  let service: TransactionsService;
  const archivedTime = new Date('2026-10-12T00:00:00Z');

  const update = (categoryId = 13, tagIds = [3, 9, 9]) =>
    service.updateTransaction(
      7,
      101,
      categoryId,
      '17.2',
      '2024-02-29',
      '  午餐  ',
      tagIds,
      '  使用优惠券  ',
    );

  beforeEach(() => {
    categoryRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 13,
        ownerUserId: 7,
        type: TransactionType.EXPENSE,
        level: 2,
        archivedTime: null,
      }),
    };
    tagRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 3, archivedTime },
        { id: 9, archivedTime: null },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: DeepPartial<TagEntity>) => data),
      save: jest.fn((data: DeepPartial<TagEntity>) =>
        Promise.resolve({ ...data, id: 10 }),
      ),
    };
    transactionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 101,
        ownerUserId: 7,
        type: TransactionType.EXPENSE,
        categoryId: 12,
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    transactionTagRepo = {
      find: jest.fn().mockResolvedValue([{ tagId: 3 }, { tagId: 5 }]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((data: DeepPartial<TransactionTagEntity>) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const repositories = new Map<unknown, unknown>([
      [UserCategoryEntity, categoryRepo],
      [UserEntity, { findOne: jest.fn().mockResolvedValue({ id: 7 }) }],
      [TagEntity, tagRepo],
      [TransactionEntity, transactionRepo],
      [TransactionTagEntity, transactionTagRepo],
    ]);
    const manager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    runTransaction = jest.fn(
      (callback: (manager: EntityManager) => Promise<void>) =>
        callback(manager as unknown as EntityManager),
    );
    // 注入仓库仅提供事务入口，所有读写必须通过事务 manager 完成。
    service = new TransactionsService(
      {
        manager: { transaction: runTransaction },
      } as unknown as Repository<TransactionEntity>,
      {} as Repository<UserCategoryEntity>,
      {} as Repository<TagEntity>,
    );
  });

  it('锁定当前用户的未删除流水，标准化字段，仅新增和删除差异标签', async () => {
    await expect(update()).resolves.toBeUndefined();

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transactionRepo.findOne).toHaveBeenCalledWith({
      where: { id: 101, ownerUserId: 7, archivedTime: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    expect(categoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 13, ownerUserId: 7, archivedTime: IsNull() },
      lock: { mode: 'pessimistic_read' },
    });
    expect(tagRepo.find).toHaveBeenCalledWith({
      select: { id: true, archivedTime: true },
      where: { id: In([3, 9]), ownerUserId: 7 },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    expect(transactionRepo.update).toHaveBeenCalledWith(
      { id: 101, ownerUserId: 7, archivedTime: IsNull() },
      {
        categoryId: 13,
        amount: '17.20',
        occurredDate: '2024-02-29',
        title: '午餐',
        remark: '使用优惠券',
      },
    );
    expect(transactionTagRepo.delete).toHaveBeenCalledWith({
      transactionId: 101,
      tagId: In([5]),
    });
    expect(transactionTagRepo.save).toHaveBeenCalledWith([
      { transactionId: 101, tagId: 9 },
    ]);
  });

  it('编辑流水时创建新名称标签，只绑定当前流水，完整操作共用同一事务', async () => {
    tagRepo.find.mockResolvedValue([{ id: 3, archivedTime }]);
    await service.updateTransaction(
      7,
      101,
      13,
      '17.28',
      '2026-10-13',
      null,
      [3],
      null,
      ['新西兰旅行'],
    );
    expect(tagRepo.save).toHaveBeenCalledTimes(1);
    expect(tagRepo.create).toHaveBeenCalledWith({
      ownerUserId: 7,
      name: '新西兰旅行',
    });
    expect(transactionTagRepo.save).toHaveBeenCalledWith([
      { transactionId: 101, tagId: 10 },
    ]);
    expect(transactionTagRepo.delete).toHaveBeenCalledWith({
      transactionId: 101,
      tagId: In([5]),
    });
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  it('保存发现新名称重名时拒绝，不修改流水或标签关联', async () => {
    tagRepo.findOne.mockResolvedValue({ id: 10 });
    await expect(
      service.updateTransaction(
        7,
        101,
        13,
        '17.28',
        '2026-10-13',
        null,
        [],
        null,
        ['新西兰旅行'],
      ),
    ).rejects.toThrow('请重新编辑该标签并确认是否继续使用');
    expect(transactionRepo.update).not.toHaveBeenCalled();
    expect(transactionTagRepo.delete).not.toHaveBeenCalled();
    expect(tagRepo.save).not.toHaveBeenCalled();
  });

  it('允许保留原已归档分类和标签，标签集合不变时不重写关联', async () => {
    categoryRepo.findOne.mockResolvedValue({
      type: TransactionType.EXPENSE,
      level: 2,
      archivedTime,
    });
    tagRepo.find.mockResolvedValue([
      { id: 3, archivedTime },
      { id: 5, archivedTime },
    ]);

    await update(12, [5, 3, 3]);

    expect(categoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 12, ownerUserId: 7 },
      lock: { mode: 'pessimistic_read' },
    });
    expect(transactionTagRepo.delete).not.toHaveBeenCalled();
    expect(transactionTagRepo.save).not.toHaveBeenCalled();
  });

  it('允许移除全部原标签，空文本保存为 NULL，保留最大金额的精度', async () => {
    await service.updateTransaction(
      7,
      101,
      13,
      '9999999999999.99',
      '2026-10-13',
      '  ',
      [],
      null,
    );

    expect(transactionRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount: '9999999999999.99',
        title: null,
        remark: null,
      }),
    );
    expect(transactionTagRepo.delete).toHaveBeenCalledWith({
      transactionId: 101,
      tagId: In([3, 5]),
    });
    expect(tagRepo.find).not.toHaveBeenCalled();
    expect(transactionTagRepo.save).not.toHaveBeenCalled();
  });

  it('不存在、其他用户或已删除的流水统一报不存在，校验前不读取关联或执行写入', async () => {
    transactionRepo.findOne.mockResolvedValue(null);

    await expect(update()).rejects.toThrow('流水记录不存在');

    expect(transactionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101, ownerUserId: 7, archivedTime: IsNull() },
      }),
    );
    expect(transactionTagRepo.find).not.toHaveBeenCalled();
    expect(categoryRepo.findOne).not.toHaveBeenCalled();
    expect(transactionRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    [TransactionType.EXPENSE, TransactionType.EXPENSE, 1],
    [TransactionType.EXPENSE, TransactionType.INCOME, 1],
    [TransactionType.INCOME, TransactionType.INCOME, 2],
    [TransactionType.INCOME, TransactionType.EXPENSE, 2],
  ])(
    '拒绝与原流水类型或层级不符的分类：%s / %s / %s',
    async (type, categoryType, level) => {
      transactionRepo.findOne.mockResolvedValue({
        id: 101,
        ownerUserId: 7,
        type,
        categoryId: 12,
      });
      categoryRepo.findOne.mockResolvedValue({ type: categoryType, level });

      await expect(update()).rejects.toBeInstanceOf(BadRequestException);
      expect(transactionRepo.update).not.toHaveBeenCalled();
    },
  );

  it('收入仅允许收入一级分类，写入不包含 type 或归属字段', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 101,
      ownerUserId: 7,
      type: TransactionType.INCOME,
      categoryId: 12,
    });
    categoryRepo.findOne.mockResolvedValue({
      type: TransactionType.INCOME,
      level: 1,
    });

    await update();

    const [, data] = transactionRepo.update.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(data).not.toHaveProperty('type');
    expect(data).not.toHaveProperty('ownerUserId');
  });

  it.each([12, 13])(
    '拒绝不存在、其他用户或新归档分类，分类id=%s',
    async (categoryId) => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(update(categoryId)).rejects.toThrow('分类不存在或已归档');
      expect(transactionRepo.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ id: 3, archivedTime }],
    [
      { id: 3, archivedTime },
      { id: 9, archivedTime },
    ],
  ])('拒绝不存在、其他用户或新增已归档标签：%j', async (tags) => {
    tagRepo.find.mockResolvedValue(tags);

    await expect(update()).rejects.toThrow('标签不存在或已归档');
    expect(transactionRepo.update).not.toHaveBeenCalled();
    expect(transactionTagRepo.delete).not.toHaveBeenCalled();
    expect(transactionTagRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    [0, 101],
    [Number.MAX_SAFE_INTEGER + 1, 101],
    [7, 0],
    [7, -1],
    [7, 1.5],
    [7, Number.MAX_SAFE_INTEGER + 1],
  ])('非法用户或流水id直接拒绝：%s / %s', async (userId, transactionId) => {
    await expect(
      service.updateTransaction(
        userId,
        transactionId,
        13,
        '1',
        '2026-10-13',
        null,
        [],
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it.each([0, 2, undefined])(
    '实际更新行数不是1时回滚，affected=%j',
    async (affected) => {
      transactionRepo.update.mockResolvedValue({ affected });

      await expect(update()).rejects.toThrow('编辑流水失败，请重新尝试');
      expect(transactionTagRepo.delete).not.toHaveBeenCalled();
      expect(transactionTagRepo.save).not.toHaveBeenCalled();
    },
  );

  it.each(['find', 'category', 'tags', 'update', 'delete', 'save'])(
    '%s数据库操作失败时向事务传播异常并返回编辑失败',
    async (step) => {
      const databaseError = new Error('database unavailable');
      const fail = {
        find: transactionRepo.findOne,
        category: categoryRepo.findOne,
        tags: tagRepo.find,
        update: transactionRepo.update,
        delete: transactionTagRepo.delete,
        save: transactionTagRepo.save,
      }[step];
      fail.mockRejectedValue(databaseError);

      const result = update();
      await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(result).rejects.toThrow('编辑流水失败，请重新尝试');
      await expect(result).rejects.toHaveProperty('cause', databaseError);

      // 事务回调必须失败，确保 TypeORM 能回滚已经执行的流水或关联写入。
      const transactionResult = runTransaction.mock.results[0]
        .value as Promise<void>;
      await expect(transactionResult).rejects.toBe(databaseError);
    },
  );
});
