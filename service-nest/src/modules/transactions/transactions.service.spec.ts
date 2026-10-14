/**
 * @author Brave
 * @date 2026-10-06
 * @description 使用真实 MySQL 查询构造器验证标签筛选的列名映射、参数绑定与全部标签加载。
 */

import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import type { Repository } from 'typeorm';
import { CategoryIconEntity } from '../categories/entities/category-icon.entity';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import { TagEntity } from '../tags/entities/tag.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// 转发实体及服务使用的 src/* 路径，保留真实元数据和查询构造逻辑。
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

/** 仅构建实体元数据；SQL 回归测试不连接数据库。 */
class QueryTestDataSource extends DataSource {
  async initializeMetadata(): Promise<void> {
    await this.buildMetadatas();
  }
}

describe('TransactionsService.findTransactions', () => {
  let source: QueryTestDataSource;
  let executeQuery: jest.SpiedFunction<
    SelectQueryBuilder<TransactionEntity>['getRawAndEntities']
  >;
  let countTags: jest.SpiedFunction<Repository<TagEntity>['countBy']>;
  let service: TransactionsService;

  beforeAll(async () => {
    source = new QueryTestDataSource({
      type: 'mysql',
      database: 'transaction_query_test',
      entities: [
        TransactionEntity,
        TransactionTagEntity,
        TagEntity,
        UserEntity,
        UserCategoryEntity,
        CategoryIconEntity,
      ],
    });
    await source.initializeMetadata();
  });

  beforeEach(() => {
    executeQuery = jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawAndEntities')
      .mockResolvedValue({ entities: [], raw: [] });
    const tagRepository = source.getRepository(TagEntity);
    countTags = jest.spyOn(tagRepository, 'countBy');
    service = new TransactionsService(
      source.getRepository(TransactionEntity),
      source.getRepository(UserCategoryEntity),
      tagRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** 取得实际执行的查询构造器，用于检查最终 SQL 而非模拟 SQL。 */
  function getExecutedSql(): [string, unknown[]] {
    const query: unknown = executeQuery.mock.contexts[0];
    if (!(query instanceof SelectQueryBuilder)) {
      throw new Error('流水查询尚未执行');
    }
    return query.getQueryAndParameters();
  }

  it('不按标签筛选时加载每条流水的全部标签', async () => {
    const result = await service.findTransactions(
      7,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-10',
    );

    const [sql] = getExecutedSql();
    expect(sql).toContain('LEFT JOIN `transaction_tags` `transactionTag`');
    expect(sql).toContain('LEFT JOIN `tags` `tag`');
    expect(sql).not.toContain('EXISTS');
    expect(countTags).not.toHaveBeenCalled();
    expect(result).toEqual({
      transactions: [],
      totalIncome: '0.00',
      totalExpense: '0.00',
    });
  });

  it.each([{ tagIds: [80] }, { tagIds: [3, 5] }, { tagIds: [80, 80] }])(
    '标签条件 $tagIds 的最终 SQL 使用数据库列名并绑定所有参数',
    async ({ tagIds }) => {
      countTags.mockResolvedValue(new Set(tagIds).size);
      await service.findTransactions(
        7,
        undefined,
        undefined,
        tagIds,
        undefined,
        undefined,
        undefined,
        undefined,
        '2026-10',
      );

      const [sql, parameters] = getExecutedSql();
      expect(sql).toContain(
        'EXISTS (SELECT 1 FROM `transaction_tags` `filteredTransactionTag`',
      );
      expect(sql).toContain(
        '`filteredTransactionTag`.`transaction_id` = `filteredTransaction`.`id`',
      );
      expect(sql).toContain(
        '`filteredTransactionTag`.`tag_id` IN (' +
          tagIds.map(() => '?').join(', ') +
          ')',
      );
      expect(sql).not.toContain('filteredTransactionTag.transactionId');
      expect(sql).not.toContain(':tagIds');
      expect(parameters.slice(-tagIds.length)).toEqual(tagIds);
      // 筛选仍用 EXISTS；展示全部标签的连接不附加筛选，窗口合计先于连接计算。
      expect(sql).toContain(
        'LEFT JOIN `transaction_tags` `transactionTag` ON `transactionTag`.`transaction_id`=`transaction`.`id`',
      );
      expect(sql.indexOf('OVER()')).toBeLessThan(
        sql.indexOf('LEFT JOIN `transaction_tags` `transactionTag`'),
      );
    },
  );

  it('拒绝不存在或不属于当前用户的标签，不执行流水查询', async () => {
    countTags.mockResolvedValue(0);
    await expect(
      service.findTransactions(7, undefined, undefined, [80]),
    ).rejects.toThrow(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
    expect(countTags).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 7 }),
    );
  });

  it('数据库查询失败时返回统一的流水查询异常', async () => {
    executeQuery.mockRejectedValue(new Error('database unavailable'));

    await expect(service.findTransactions(7)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
