/**
 * @author Brave
 * @date 2026-10-06
 * @description 流水查询服务单元测试，验证标签加载和标签筛选相互独立。
 */

import { InternalServerErrorException } from '@nestjs/common';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// UserCategoryEntity 内部使用了仅供 Nest 构建器识别的 src/* 路径；
// 这里隔离该无关依赖，让单元测试只关注流水查询本身。
jest.mock('../categories/entities/user-category.entity', () => ({
  UserCategoryEntity: class UserCategoryEntity {},
}));

describe('TransactionsService', () => {
  let repository: jest.Mocked<
    Pick<Repository<TransactionEntity>, 'createQueryBuilder'>
  >;
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
    subQuery: jest.Mock;
  };
  let tagFilterSubQuery: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getQuery: jest.Mock;
  };
  let service: TransactionsService;

  beforeEach(() => {
    tagFilterSubQuery = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('(SELECT 1 FROM transaction_tags)'),
    };
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      subQuery: jest.fn().mockReturnValue(tagFilterSubQuery),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new TransactionsService(
      {} as UsersService,
      repository as unknown as Repository<TransactionEntity>,
    );
  });

  it('不按标签筛选时加载每条流水的全部标签', async () => {
    await service.findDailyTxn(7);

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('txn');
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      1,
      'txn.transactionTags',
      'transactionTag',
    );
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      2,
      'transactionTag.tag',
      'tag',
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
  });

  it('按标签筛选时使用独立子查询且不改变加载全部标签的连接', async () => {
    await service.findDailyTxn(7, undefined, undefined, [3, 5]);

    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(2);
    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);

    const [condition, parameters] = queryBuilder.andWhere.mock.calls[0] as [
      (builder: SelectQueryBuilder<TransactionEntity>) => string,
      { tagIds: number[] },
    ];
    expect(parameters).toEqual({ tagIds: [3, 5] });
    expect(
      condition(
        queryBuilder as unknown as SelectQueryBuilder<TransactionEntity>,
      ),
    ).toBe('EXISTS (SELECT 1 FROM transaction_tags)');
    expect(tagFilterSubQuery.from).toHaveBeenCalledWith(
      TransactionTagEntity,
      'filteredTransactionTag',
    );
    expect(tagFilterSubQuery.where).toHaveBeenCalledWith(
      'filteredTransactionTag.transactionId = txn.id',
    );
    expect(tagFilterSubQuery.andWhere).toHaveBeenCalledWith(
      'filteredTransactionTag.tagId IN (:...tagIds)',
    );
  });

  it('数据库查询失败时返回统一的流水查询异常', async () => {
    queryBuilder.getMany.mockRejectedValue(new Error('database unavailable'));

    await expect(service.findDailyTxn(7)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
