/**
 * @author Brave
 * @date 2026-09-30T14:27:15+08:00
 * @description 分类服务单元测试，验证归档分类的可选查询与稳定排序。
 */

import type { Repository } from 'typeorm';
import { TransactionType } from '../transactions/enums/transaction-type-enum';
import { CategoriesService } from './categories.service';
import { CategoryIconEntity } from './entities/category-icon.entity';
import { CategoryTemplateEntity } from './entities/category-template.entity';
import { UserCategoryEntity } from './entities/user-category.entity';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// Jest 未配置 src/* 路径映射，为实体中的既有绝对导入提供局部替身。
jest.mock(
  'src/modules/transactions/enums/transaction-type-enum',
  () => ({
    TransactionType: {
      EXPENSE: 'expense',
      INCOME: 'income',
    },
  }),
  { virtual: true },
);

describe('CategoriesService', () => {
  const createCategory = (
    overrides: Partial<UserCategoryEntity> = {},
  ): UserCategoryEntity => ({
    id: 1,
    ownerUserId: 7,
    sourceTplId: null,
    type: TransactionType.EXPENSE,
    parentId: null,
    name: '餐饮',
    sortOrder: 0,
    level: 1,
    iconKey: 'icon-expense-food',
    archivedTime: null,
    createdTime: new Date('2026-09-01T00:00:00+08:00'),
    updatedTime: new Date('2026-09-01T00:00:00+08:00'),
    ...overrides,
  });

  let userCategoryRepo: jest.Mocked<
    Pick<Repository<UserCategoryEntity>, 'findBy'>
  >;
  let categoryIconRepo: jest.Mocked<
    Pick<Repository<CategoryIconEntity>, 'find'>
  >;
  let service: CategoriesService;

  beforeEach(() => {
    userCategoryRepo = {
      findBy: jest.fn().mockResolvedValue([]),
    };
    categoryIconRepo = {
      find: jest.fn().mockResolvedValue([
        {
          iconKey: 'icon-expense-food',
          backgroundColor: '#F5A623',
        } as CategoryIconEntity,
      ]),
    };

    service = new CategoriesService(
      {} as Repository<CategoryTemplateEntity>,
      userCategoryRepo as unknown as Repository<UserCategoryEntity>,
      categoryIconRepo as unknown as Repository<CategoryIconEntity>,
    );
  });

  it('默认只查询未归档分类', async () => {
    userCategoryRepo.findBy.mockResolvedValue([createCategory()]);

    await expect(
      service.findAllForUser(7, TransactionType.EXPENSE),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1, archived: false, children: [] }),
    ]);

    const where = userCategoryRepo.findBy.mock.calls[0][0];
    expect(where).toEqual(
      expect.objectContaining({
        ownerUserId: 7,
        type: TransactionType.EXPENSE,
      }),
    );
    expect(where).toHaveProperty('archivedTime');
  });

  it('账单筛选请求已归档分类时按同级未归档优先排序', async () => {
    const activeParent = createCategory({ id: 1, sortOrder: 10 });
    const archivedParent = createCategory({
      id: 2,
      name: '旧餐饮',
      sortOrder: 0,
      archivedTime: new Date('2026-09-30T12:00:00+08:00'),
    });
    const activeChild = createCategory({
      id: 3,
      parentId: 1,
      name: '早餐',
      sortOrder: 10,
      level: 2,
    });
    const archivedChild = createCategory({
      id: 4,
      parentId: 1,
      name: '旧早餐',
      sortOrder: 0,
      level: 2,
      archivedTime: new Date('2026-09-30T12:00:00+08:00'),
    });
    userCategoryRepo.findBy.mockResolvedValue([
      archivedParent,
      archivedChild,
      activeParent,
      activeChild,
    ]);

    const result = await service.findAllForUser(
      7,
      TransactionType.EXPENSE,
      true,
    );

    expect(result.map((category) => category.id)).toEqual([1, 2]);
    expect(result[0].children.map((category) => category.id)).toEqual([3, 4]);
    expect(result[0].archived).toBe(false);
    expect(result[1].archived).toBe(true);
    expect(result[0].children[0].archived).toBe(false);
    expect(result[0].children[1].archived).toBe(true);

    const where = userCategoryRepo.findBy.mock.calls[0][0];
    expect(where).toEqual({
      ownerUserId: 7,
      type: TransactionType.EXPENSE,
    });
    expect(where).not.toHaveProperty('archivedTime');
  });
});
