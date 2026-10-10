/**
 * @author Brave
 * @date 2026-09-30 09:51:25
 * @description 流水服务层
 */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import { TransactionType } from './enums/transaction-type-enum';
import {
  LIKE_ESCAPE_CHARACTER,
  escapeLikePattern,
} from '../../common/util/escapeLikePattern';
import { UserCategoryEntity } from '../categories/entities/user-category.entity';
import { TagEntity } from '../tags/entities/tag.entity';
import { TransactionTagEntity } from './entities/transaction-tag.entity';
import {
  normalizeAmount,
  amountToCents,
  centsToAmount,
} from 'src/common/util/convertAmount';

interface CompleteTransaction {
  transactions: TransactionEntity[];
  totalIncome: string;
  totalExpense: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionEntity: Repository<TransactionEntity>,
    @InjectRepository(UserCategoryEntity)
    private readonly userCategoryRepo: Repository<UserCategoryEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepo: Repository<TagEntity>,
  ) {}

  /**
   * 校验日明细、月汇总共用的筛选条件。
   * @param userId 用户id
   * @param type 流水类型
   * @param categoryIds 流水分类id集合
   * @param tagIds 流水标签id集合
   * @param minAmount 金额最小值
   * @param maxAmount 金额最大值
   * @param month 流水月份
   * @param year 流水年份
   */
  private async validateQueryFilters(
    userId: number,
    type?: TransactionType,
    categoryIds?: number[],
    tagIds?: number[],
    minAmount?: string,
    maxAmount?: string,
    month?: string,
    year?: string,
  ): Promise<void> {
    // 月份和年份条件只能存在一个
    if (month && year) {
      throw new BadRequestException('时间筛选有误，只能同时存在一个');
    }

    // 1. 校验金额上下限
    if (
      minAmount !== undefined &&
      maxAmount !== undefined &&
      amountToCents(minAmount) > amountToCents(maxAmount)
    ) {
      throw new BadRequestException('最小金额不能大于最大金额');
    }

    // 去重后再与数据库查询数量比较
    const uniqueCategoryIds = [...new Set(categoryIds ?? [])];
    const uniqueTagIds = [...new Set(tagIds ?? [])];

    // 2. 校验分类归属和收支类型
    if (uniqueCategoryIds.length > 0) {
      const categories = await this.userCategoryRepo.find({
        where: {
          ownerUserId: userId,
          id: In(uniqueCategoryIds),
        },
        select: {
          id: true,
          type: true,
        },
      });

      // 不存在的分类、其他用户的分类，都会报错
      if (categories.length !== uniqueCategoryIds.length) {
        throw new BadRequestException('筛选分类不存在或不可用');
      }

      if (
        type !== undefined &&
        categories.some((category) => category.type !== type)
      ) {
        throw new BadRequestException('筛选分类与流水类型不一致');
      }
    }

    // 3. 校验标签归属
    if (uniqueTagIds.length > 0) {
      const count = await this.tagRepo.countBy({
        ownerUserId: userId,
        id: In(uniqueTagIds),
      });

      if (count !== uniqueTagIds.length) {
        throw new BadRequestException('筛选标签不存在或不可用');
      }
    }
  }

  /**
   * 给月份添加日期，满足SQL日期的筛选格式
   * @param month 月份 YYYY-MM
   * @returns 符合SQL日期筛选的格式 YYYY-MM-DD
   */
  private getMonthDateRange(month: string): {
    startDate: string;
    endDate: string;
  } {
    const [year, monthNumber] = month.split('-').map(Number);

    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;

    return {
      startDate: `${month}-01`,
      endDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    };
  }

  /**
   * 给年份添加日期，满足SQL日期的筛选格式
   * @param year 年份 YYYY
   * @returns 符合SQL日期筛选的格式 YYYY-MM-DD
   */
  private getYearDateRange(year: string): {
    startDate: string;
    endDate: string;
  } {
    return {
      startDate: `${year}-01-01`,
      endDate: `${Number(year) + 1}-01-01`,
    };
  }

  /**
   * 根据条件查询流水
   * @param userId 用户id
   * @param type 流水类型
   * @param categoryIds 流水分类id集合
   * @param tagIds 流水标签id集合
   * @param title 流水标题
   * @param remark 流水备注
   * @param minAmount 金额最小值
   * @param maxAmount 金额最大值
   * @param month 流水月份
   * @param year 流水年份
   * @returns 符合条件的流水列表
   */
  async findTransactions(
    userId: number,
    type?: TransactionType,
    categoryIds?: number[],
    tagIds?: number[],
    title?: string,
    remark?: string,
    minAmount?: string,
    maxAmount?: string,
    month?: string,
    year?: string,
  ): Promise<CompleteTransaction> {
    // 校验参数
    await this.validateQueryFilters(
      userId,
      type,
      categoryIds,
      tagIds,
      minAmount,
      maxAmount,
      month,
      year,
    );

    // 年份筛选时，不会筛选标题、标签、备注
    if (year && ((tagIds?.length ?? 0) > 0 || title || remark)) {
      throw new BadRequestException(
        '按年展示账单周期时，无法筛选标题、标签、备注',
      );
    }

    // 构建条件
    const where: FindOptionsWhere<TransactionEntity> = {
      ownerUserId: userId,
      archivedTime: IsNull(),
    };

    if (type) {
      where.type = type;
    }

    if (title) {
      const escapedTitle = escapeLikePattern(title);
      // 转义特殊字符，避免扩大搜索范围
      where.title = Raw(
        (columnAlias) =>
          `${columnAlias} LIKE :titlePattern ESCAPE '${LIKE_ESCAPE_CHARACTER}' `,
        {
          titlePattern: `%${escapedTitle}%`,
        },
      );
    }

    if (remark) {
      const escapedRemark = escapeLikePattern(remark);
      where.remark = Raw(
        (columnAlias) =>
          `${columnAlias} LIKE :remarkPattern ESCAPE '${LIKE_ESCAPE_CHARACTER}' `,
        {
          remarkPattern: `%${escapedRemark}%`,
        },
      );
    }

    if (minAmount !== undefined && maxAmount !== undefined) {
      where.amount = Between(minAmount, maxAmount);
    } else if (minAmount !== undefined) {
      where.amount = MoreThanOrEqual(minAmount);
    } else if (maxAmount !== undefined) {
      where.amount = LessThanOrEqual(maxAmount);
    }

    try {
      /*
       * 内层查询：
       * 1. 筛选符合条件的流水
       * 2. 在关联标签之前计算总金额
       */
      const filteredQuery = this.transactionEntity
        .createQueryBuilder('filteredTransaction')
        .select('filteredTransaction.id', 'id')
        .addSelect(
          `SUM(CASE WHEN filteredTransaction.type =:incomeType THEN filteredTransaction.amount ELSE 0 END) OVER()`,
          'total_income',
        )
        .addSelect(
          `SUM(CASE WHEN filteredTransaction.type =:expenseType THEN filteredTransaction.amount ELSE 0 END) OVER()`,
          'total_expense',
        )
        .where(where)
        .setParameters({
          incomeType: TransactionType.INCOME,
          expenseType: TransactionType.EXPENSE,
        });

      // 3. 筛选月周期内的流水
      if (month) {
        const { startDate, endDate } = this.getMonthDateRange(month);

        filteredQuery.andWhere(
          `
          filteredTransaction.occurredDate >= :startDate
          AND filteredTransaction.occurredDate < :endDate
        `,
          {
            startDate,
            endDate,
          },
        );
      }

      // 4. 筛选年周期内的流水
      if (year) {
        const { startDate, endDate } = this.getYearDateRange(year);

        filteredQuery.andWhere(
          `
          filteredTransaction.occurredDate >= :startDate
          AND filteredTransaction.occurredDate < :endDate
        `,
          {
            startDate,
            endDate,
          },
        );
      }

      // 5. 筛选包含任意一个指定标签的流水
      if (tagIds?.length) {
        filteredQuery.andWhere(
          (queryBuilder) => {
            const tagExistsQuery = queryBuilder
              .subQuery()
              .select('1')
              .from(TransactionTagEntity, 'filteredTransactionTag')
              .where(
                `
                filteredTransactionTag.transactionId
                = filteredTransaction.id
              `,
              )
              .andWhere('filteredTransactionTag.tagId IN (:...tagIds)')
              .getQuery();

            return `EXISTS ${tagExistsQuery}`;
          },
          {
            tagIds,
          },
        );
      }

      // 6. 关联流水实际绑定的分类
      if (categoryIds?.length) {
        /**
         * 这是一对一方向的关联，不会像标签关联一样
         * 将一条流水复制成多行，因此不会造成金额重复统计。
         */
        filteredQuery.innerJoin(
          'filteredTransaction.category',
          'filteredCategory',
        );

        filteredQuery.andWhere(
          `
            (
              filteredCategory.id IN (:...categoryIds)
              OR filteredCategory.parentId IN (:...categoryIds)
            )
          `,
          {
            categoryIds,
          },
        );
      }

      /*
       * 外层查询：
       * 根据内层查询得到的流水 ID 查询完整实体，
       * 然后关联流水的全部标签。
       */
      const queryBuilder = this.transactionEntity
        .createQueryBuilder('transaction')
        .innerJoin(
          // ilteredQuery.getQuery() 只取出 SQL 字符串，如得到的字符串里只有:userId 、:startDate等等。参数的真实值仍然保存在 filteredQuery 内部，类似{userId: 1,startDate: '2026-10-01',}，这一步叫手动嵌入子查询。把 SQL 字符串放进外层查询后，外层 queryBuilder 并不知道这些参数是什么，需要显示设置参数
          // 自动嵌入，就是使用 QueryBuilder 的回调形式的方式而不是现在的string。回调形式下 TypeORM 会自动把子查询参数合并到外层 QueryBuilder。
          `(${filteredQuery.getQuery()})`,
          'filtered',
          'filtered.id = transaction.id',
        )
        /**
         * 加载流水实际绑定的分类：
         *
         * 支出流水绑定的是二级分类；
         * 收入流水绑定的是一级分类。
         */
        .leftJoinAndSelect('transaction.category', 'category')
        /**
         * 加载实际分类对应的图标。
         *
         * 支出时主要使用二级分类的 iconKey；
         * 收入时使用一级分类的 iconKey 和背景色。
         */
        .leftJoinAndSelect('category.icon', 'categoryIcon')
        /**
         * 加载实际分类的父分类：
         *
         * 支出二级分类可以得到对应一级分类；
         * 收入一级分类没有父分类，这里得到 null。
         */
        .leftJoinAndSelect('category.parent', 'primaryCategory')
        /**
         * 加载父分类图标。
         *
         * 支出二级分类最终展示的背景色继承一级分类，
         * 所以还需要父分类的图标信息。
         */
        .leftJoinAndSelect('primaryCategory.icon', 'primaryCategoryIcon')
        // 加载流水与标签的关联记录
        .leftJoinAndSelect('transaction.transactionTag', 'transactionTag')
        // 加载标签实体
        .leftJoinAndSelect('transactionTag.tag', 'tag')
        // 将内层查询的筛选收入合计返回给外层
        .addSelect('filtered.total_income', 'total_income')
        // 将内层查询的筛选支出合计返回给外层
        .addSelect('filtered.total_expense', 'total_expense')
        // 手动嵌入子查询时，参数不会自动传递，需要显式设置
        .setParameters(filteredQuery.getParameters())
        .orderBy('transaction.occurredDate', 'DESC')
        .addOrderBy('transaction.createdTime', 'DESC')
        .addOrderBy('transaction.id', 'DESC');

      /*
       * total_income、total_expense 不是 TransactionEntity 字段，需要手动从原始结果中获取
       * 因此需要同时获取实体结果和原始结果。
       */
      const { entities, raw } = await queryBuilder.getRawAndEntities();
      /**
       * 窗口函数的统计结果是数据库 DECIMAL 字符串。
       * 没有匹配流水时 raw 为空，normalizeAmount 会返回 "0.00"。
       */
      const totalIncome = normalizeAmount(raw[0]?.total_income);

      const totalExpense = normalizeAmount(raw[0]?.total_expense);

      // TypeORM会自动把关系型数据库的扁平数据整理为嵌套对象
      return {
        transactions: entities,
        totalIncome,
        totalExpense,
      };
    } catch (error) {
      throw new InternalServerErrorException('查询流水失败，请重试');
    }
  }

  /**
   * 以月为周期查询流水
   * @param userId 用户id
   * @param month 流水月份
   * @param type 流水类型
   * @param categoryIds 流水分类id集合
   * @param tagIds 流水标签id集合
   * @param title 流水标题
   * @param remark 流水备注
   * @param minAmount 金额最小值
   * @param maxAmount 金额最大值
   * @returns 每月流水列表
   */
  async findDailyTransactions(
    userId: number,
    month: string,
    type?: TransactionType,
    categoryIds?: number[],
    tagIds?: number[],
    title?: string,
    remark?: string,
    minAmount?: string,
    maxAmount?: string,
  ) {
    // 根据条件查询流水
    const transactions = await this.findTransactions(
      userId,
      type,
      categoryIds,
      tagIds,
      title,
      remark,
      minAmount,
      maxAmount,
      month,
    );

    // 获取指定月份的统计数据：支出、收入、结余
    const { startDate, endDate } = this.getMonthDateRange(month);
    const totalAmount = await this.transactionEntity
      .createQueryBuilder('transactions')
      .select(
        `SUM(CASE WHEN transactions.type =:incomeType THEN transactions.amount ELSE 0 END)`,
        'total_income',
      )
      .addSelect(
        `SUM(CASE WHEN transactions.type =:expenseType THEN transactions.amount ELSE 0 END)`,
        'total_expense',
      )
      .where('transactions.ownerUserId = :userId', {
        userId,
      })
      .andWhere('transactions.archivedTime IS NULL')
      .andWhere(
        ` transactions.occurredDate >= :startDate
          AND transactions.occurredDate < :endDate`,
        {
          startDate,
          endDate,
        },
      )
      .setParameters({
        incomeType: TransactionType.INCOME,
        expenseType: TransactionType.EXPENSE,
      })
      .getRawOne<{
        total_income: string | null;
        total_expense: string | null;
      }>();

    // 完整月份的收入合计
    const totalIncome = normalizeAmount(totalAmount?.total_income);

    // 完整月份的支出合计
    const totalExpense = normalizeAmount(totalAmount?.total_expense);

    // 使用整数“分”计算结余，避免浮点数误差
    const balance = centsToAmount(
      amountToCents(totalIncome) - amountToCents(totalExpense),
    );

    // 组装数据
  }

  async findMonthlySummary() {}
}
