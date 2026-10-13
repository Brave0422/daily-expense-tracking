/**
 * @author Brave
 * @date 2026-10-13T20:54:56+08:00
 * @description 流水删除测试，覆盖用户归属、独占标签清理、共享引用和事务失败。
 */
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import { TagEntity } from '../tags/entities/tag.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
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

describe('TransactionsService.archive', () => {
  let userRepo: { findOne: jest.Mock };
  let transactionRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let transactionTagRepo: { find: jest.Mock; delete: jest.Mock };
  let tagRepo: { find: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let runTransaction: jest.Mock;
  let service: TransactionsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-13T12:00:00Z'));
    userRepo = { findOne: jest.fn().mockResolvedValue({ id: 7 }) };
    transactionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 101 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn(),
    };
    transactionTagRepo = {
      find: jest
        .fn()
        .mockResolvedValueOnce([{ tagId: 3 }, { tagId: 5 }])
        .mockResolvedValue([]),
      delete: jest.fn(),
    };
    tagRepo = {
      find: jest.fn().mockResolvedValue([{ id: 3 }, { id: 5 }]),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
      delete: jest.fn(),
    };
    const repositories = new Map<unknown, unknown>([
      [UserEntity, userRepo],
      [TransactionEntity, transactionRepo],
      [TransactionTagEntity, transactionTagRepo],
      [TagEntity, tagRepo],
    ]);
    const manager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    runTransaction = jest.fn(
      (
        _isolation: string,
        callback: (manager: EntityManager) => Promise<void>,
      ) => callback(manager as unknown as EntityManager),
    );
    service = new TransactionsService(
      {
        manager: { transaction: runTransaction },
      } as unknown as Repository<TransactionEntity>,
      {} as Repository<UserCategoryEntity>,
      {} as Repository<TagEntity>,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('同一事务归档流水和独占标签，保留实体及历史关联，并按用户、流水、标签顺序加锁', async () => {
    await expect(service.archive(7, 101)).resolves.toBeUndefined();
    expect(runTransaction).toHaveBeenCalledWith(
      'READ COMMITTED',
      expect.any(Function),
    );
    expect(userRepo.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: 7 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(transactionRepo.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: 101, ownerUserId: 7, archivedTime: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    expect(tagRepo.find).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: In([3, 5]), ownerUserId: 7, archivedTime: IsNull() },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(transactionRepo.update).toHaveBeenCalledWith(
      { id: 101, ownerUserId: 7, archivedTime: IsNull() },
      { archivedTime: new Date('2026-10-13T12:00:00Z') },
    );
    expect(tagRepo.update).toHaveBeenCalledWith(
      { id: In([3, 5]), ownerUserId: 7, archivedTime: IsNull() },
      { archivedTime: new Date('2026-10-13T12:00:00Z') },
    );
    expect(userRepo.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      transactionRepo.findOne.mock.invocationCallOrder[0],
    );
    expect(tagRepo.find.mock.invocationCallOrder[0]).toBeLessThan(
      transactionRepo.update.mock.invocationCallOrder[0],
    );
    expect(transactionRepo.delete).not.toHaveBeenCalled();
    expect(transactionTagRepo.delete).not.toHaveBeenCalled();
    expect(tagRepo.delete).not.toHaveBeenCalled();
  });

  it('查询所有周期的当前用户未删除引用，只归档独占标签，跨周期共享标签保留', async () => {
    transactionTagRepo.find
      .mockReset()
      .mockResolvedValueOnce([{ tagId: 3 }, { tagId: 5 }])
      .mockResolvedValueOnce([{ tagId: 5 }, { tagId: 5 }]);
    tagRepo.update.mockResolvedValue({ affected: 1 });
    await service.archive(7, 101);
    expect(transactionTagRepo.find).toHaveBeenNthCalledWith(2, {
      select: { tagId: true },
      where: {
        tagId: In([3, 5]),
        transaction: { ownerUserId: 7, archivedTime: IsNull() },
      },
    });
    expect(tagRepo.update).toHaveBeenCalledWith(
      { id: In([3]), ownerUserId: 7, archivedTime: IsNull() },
      { archivedTime: new Date('2026-10-13T12:00:00Z') },
    );
  });

  it('连续删除共享标签的流水，只有最后一条有效引用删除后归档标签', async () => {
    transactionTagRepo.find
      .mockReset()
      .mockResolvedValueOnce([{ tagId: 5 }])
      .mockResolvedValueOnce([{ tagId: 5 }])
      .mockResolvedValueOnce([{ tagId: 5 }])
      .mockResolvedValueOnce([]);
    tagRepo.find.mockResolvedValue([{ id: 5 }]);
    tagRepo.update.mockResolvedValue({ affected: 1 });
    await service.archive(7, 101);
    expect(tagRepo.update).not.toHaveBeenCalled();
    await service.archive(7, 102);
    expect(tagRepo.update).toHaveBeenCalledTimes(1);
    expect(tagRepo.update).toHaveBeenCalledWith(
      { id: In([5]), ownerUserId: 7, archivedTime: IsNull() },
      { archivedTime: new Date('2026-10-13T12:00:00Z') },
    );
  });

  it('无标签时只归档流水，不扫描或更新其他标签', async () => {
    transactionTagRepo.find.mockReset().mockResolvedValue([]);
    await service.archive(7, 101);
    expect(transactionRepo.update).toHaveBeenCalledTimes(1);
    expect(transactionTagRepo.find).toHaveBeenCalledTimes(1);
    expect(tagRepo.find).not.toHaveBeenCalled();
    expect(tagRepo.update).not.toHaveBeenCalled();
  });

  it('原标签已经归档时不重复更新时间', async () => {
    tagRepo.find.mockResolvedValue([]);
    await service.archive(7, 101);
    expect(transactionRepo.update).toHaveBeenCalledTimes(1);
    expect(tagRepo.update).not.toHaveBeenCalled();
  });

  it('不存在、越权或重复删除统一拒绝且不写入', async () => {
    transactionRepo.findOne.mockResolvedValue(null);
    await expect(service.archive(7, 101)).rejects.toThrow('流水记录不存在');
    expect(transactionRepo.update).not.toHaveBeenCalled();
    expect(transactionTagRepo.find).not.toHaveBeenCalled();
    expect(tagRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    [0, 101],
    [7, 0],
    [-1, 101],
    [7, 1.5],
    [7, Number.MAX_SAFE_INTEGER + 1],
  ])(
    '无效用户或流水id在开始事务前拒绝：%s / %s',
    async (userId, transactionId) => {
      await expect(
        service.archive(userId, transactionId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(runTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([0, 2, undefined])(
    '流水更新行数 %s 不等于1时中止事务，不清理标签',
    async (affected) => {
      transactionRepo.update.mockResolvedValue({ affected });
      await expect(service.archive(7, 101)).rejects.toThrow(
        '删除流水失败，请重新尝试',
      );
      expect(tagRepo.update).not.toHaveBeenCalled();
    },
  );

  it('标签更新数量异常或数据库失败时拒绝事务，不能报告流水删除成功', async () => {
    tagRepo.update.mockResolvedValueOnce({ affected: 1 });
    await expect(service.archive(7, 101)).rejects.toThrow(
      '删除流水标签失败，请重新尝试',
    );
    transactionTagRepo.find
      .mockReset()
      .mockResolvedValueOnce([{ tagId: 3 }, { tagId: 5 }])
      .mockResolvedValue([]);
    tagRepo.update.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.archive(7, 101)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
