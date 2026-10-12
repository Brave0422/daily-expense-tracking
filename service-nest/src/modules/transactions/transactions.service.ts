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
  EntityManager,
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
import { toDateKey } from 'src/common/util/common';
import {
  DailyTransactionItem,
  DailyTransactionGroup,
  DailyTransactionsResult,
  CategorySummaryItem,
  MonthlySummaryGroup,
  MonthlySummaryResult,
} from './interfaces/transaction-result';

// 完整的流水记录
interface CompleteTransaction {
  transactions: TransactionEntity[];
  totalIncome: string;
  totalExpense: string;
}

interface TransactionTotalsRaw {
  total_income: string | null;
  total_expense: string | null;
}

// 周期内的所有金额汇总
interface PeriodAmountSummary {
  totalIncome: string;
  totalExpense: string;
  balance: string;
}

// 一个分类的内部累计结果。
interface CategoryAmountAccumulator {
  category: UserCategoryEntity;
  amountCents: bigint;
}

// 支出一级分类还需要保存其二级分类汇总。
interface ExpenseCategoryAccumulator extends CategoryAmountAccumulator {
  children: Map<number, CategoryAmountAccumulator>;
}

// 一个月份的内部累计结果。
interface MonthlySummaryAccumulator {
  month: number;
  expenseCents: bigint;
  incomeCents: bigint;
  expenseCategories: Map<number, ExpenseCategoryAccumulator>;
  incomeCategories: Map<number, CategoryAmountAccumulator>;
}

// 创建流水时已校验、规范化的数据，标签id已去重。
interface CreateTransactionData {
  ownerUserId: number;
  type: TransactionType;
  categoryId: number;
  amount: string;
  occurredDate: string;
  title: string | null;
  remark: string | null;
  tagIds: number[];
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepo: Repository<TransactionEntity>,
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
      const filteredQuery = this.transactionRepo
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
      const queryBuilder = this.transactionRepo
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
      const { entities, raw } =
        await queryBuilder.getRawAndEntities<TransactionTotalsRaw>();
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
    } catch {
      throw new InternalServerErrorException('查询流水失败，请重试');
    }
  }

  /**
   * 把数据库流水实体转换成接口需要返回的流水结构。
   *
   * 这里主要完成：
   * 1. 金额格式化；
   * 2. 一级、二级分类拆分；
   * 3. 标签关联表扁平化。
   * @param transaction 流水实体
   * @returns 单条流水详情
   */
  private assembleDailyTransaction(
    transaction: TransactionEntity,
  ): DailyTransactionItem {
    const actualCategory = transaction.category;

    // findTransactions 已经 JOIN 了 category，正常情况下不会不存在。
    // 这里保留检查，避免关联数据异常时返回难以理解的错误。
    if (!actualCategory) {
      throw new InternalServerErrorException(
        `流水 ${transaction.id} 未查询到分类信息`,
      );
    }

    /*
     * 支出二级分类：
     * actualCategory 是二级分类，actualCategory.parent 是一级分类。
     *
     * 支出一级分类或收入分类：
     * actualCategory 本身就是一级分类，不存在 parent。
     */
    const primaryCategory = actualCategory.parent ?? actualCategory;
    const secondaryCategory = actualCategory.parent ? actualCategory : null;

    if (!primaryCategory.icon) {
      throw new InternalServerErrorException(
        `分类 ${primaryCategory.id} 未查询到图标信息`,
      );
    }

    return {
      id: transaction.id,
      type: transaction.type,

      // 无论数据库返回什么格式，都保证接口金额为两位小数字符串。
      amount: normalizeAmount(transaction.amount),

      title: transaction.title ?? null,
      remark: transaction.remark ?? null,
      occurredDate: toDateKey(transaction.occurredDate),

      category: {
        primary: {
          id: primaryCategory.id,
          name: primaryCategory.name,
          iconKey: primaryCategory.iconKey,
          backgroundColor: primaryCategory.icon.backgroundColor,
          archived: primaryCategory.archivedTime !== null,
        },

        // 没有父分类意味着当前分类本身就是一级分类。
        secondary: secondaryCategory
          ? {
              id: secondaryCategory.id,
              name: secondaryCategory.name,
              iconKey: secondaryCategory.iconKey,

              /*
               * 二级分类的展示背景色继承一级分类。
               * 因此这里使用 primaryCategory.icon.backgroundColor。
               */
              backgroundColor: primaryCategory.icon.backgroundColor,
              archived: secondaryCategory.archivedTime !== null,
            }
          : null,
      },

      /*
       * transactionTag 是关联表数组。
       * 接口不需要暴露关联表，因此只取其中真正的 tag。
       */
      tags: (transaction.transactionTag ?? [])
        .filter((transactionTag) => transactionTag.tag !== undefined)
        .map((transactionTag) => ({
          id: transactionTag.tag.id,
          name: transactionTag.tag.name,
          archived: transactionTag.tag.archivedTime !== null,
        })),
    };
  }

  /**
   * 统计指定日期范围内的收支
   * @param userId 用户id
   * @param month 月份
   * @param month 月份
   * @returns 指定月份的金额统计
   */
  private async calculatePeriodAmount(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<PeriodAmountSummary> {
    const totalAmount = await this.transactionRepo
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

    return {
      totalIncome,
      totalExpense,
      balance,
    };
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
  ): Promise<DailyTransactionsResult> {
    // 按“指定月份 + 当前筛选条件”查询流水和筛选合计
    const {
      transactions: filteredTransactions,
      totalIncome: filterTotalIncome,
      totalExpense: filterTotalExpense,
    } = await this.findTransactions(
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

    // 获取指定月份的金额统计数据
    const { startDate, endDate } = this.getMonthDateRange(month);
    const { totalIncome, totalExpense, balance } =
      await this.calculatePeriodAmount(userId, startDate, endDate);

    // 组装数据

    /*
     * Map 的 key 是日期。
     * 每遇到一条流水，就把它加入对应日期的分组，
     * 同时累加该日收入或支出。
     */
    const dayMap = new Map<
      string,
      {
        date: string;
        expenseCents: bigint;
        incomeCents: bigint;
        transactions: DailyTransactionItem[];
      }
    >();

    for (const transaction of filteredTransactions) {
      const date = toDateKey(transaction.occurredDate);

      /*
       * 当前日期第一次出现时，创建当天的统计容器。
       */
      let day = dayMap.get(date);

      if (!day) {
        day = {
          date,
          expenseCents: 0n,
          incomeCents: 0n,
          transactions: [],
        };

        dayMap.set(date, day);
      }

      /*
       * 使用“分”累加每天的金额，避免 JavaScript 小数精度问题。
       */
      const amountCents = amountToCents(transaction.amount);

      if (transaction.type === TransactionType.EXPENSE) {
        day.expenseCents += amountCents;
      } else {
        day.incomeCents += amountCents;
      }

      /*
       * 将数据库实体转换成接口所需结构后放入当天的流水列表。
       *
       * findTransactions 已经按照：
       * occurredDate DESC、createdTime DESC、id DESC 排序，
       * Map 和数组会保留这个顺序。
       */
      day.transactions.push(this.assembleDailyTransaction(transaction));
    }

    // 把内部使用的 Map 和 bigint 转换成最终接口结构
    const days: DailyTransactionGroup[] = Array.from(dayMap.values()).map(
      (day) => ({
        date: day.date,
        expenseTotal: centsToAmount(day.expenseCents),
        incomeTotal: centsToAmount(day.incomeCents),
        transactions: day.transactions,
      }),
    );

    /*
     * totals：整个月份的统计，不受业务筛选条件影响。
     * filterTotals：应用筛选条件后的统计。
     * days：只包含筛选后实际存在流水的日期。
     */
    return {
      period: month,

      totals: {
        expense: totalExpense,
        income: totalIncome,
        balance,
      },

      filterTotals: {
        expense: filterTotalExpense,
        income: filterTotalIncome,
      },

      days,
    };
  }

  /**
   * 以年为周期查询流水
   * @param userId 用户id
   * @param year 流水月份
   * @param type 流水类型
   * @param categoryIds 流水分类id集合
   * @param minAmount 金额最小值
   * @param maxAmount 金额最大值
   * @returns 每年流水列表
   */
  async findMonthlySummary(
    userId: number,
    year: string,
    type?: TransactionType,
    categoryIds?: number[],
    minAmount?: string,
    maxAmount?: string,
  ): Promise<MonthlySummaryResult> {
    // 按“指定年份 + 当前筛选条件”查询流水和筛选合计，年周期不支持标签、标题、备注
    const {
      transactions: filteredTransactions,
      totalIncome: filterTotalIncome,
      totalExpense: filterTotalExpense,
    } = await this.findTransactions(
      userId,
      type,
      categoryIds,
      undefined, // tagIds
      undefined, // title
      undefined, // remark
      minAmount,
      maxAmount,
      undefined, // month
      year,
    );

    // 获取指定年份的金额统计数据
    const { startDate, endDate } = this.getYearDateRange(year);
    const { totalIncome, totalExpense, balance } =
      await this.calculatePeriodAmount(userId, startDate, endDate);

    // 组装数据
    const months = this.assembleMonthlySummary(filteredTransactions);

    return {
      period: year,

      totals: {
        expense: totalExpense,
        income: totalIncome,
        balance,
      },

      filterTotals: {
        expense: filterTotalExpense,
        income: filterTotalIncome,
      },

      months,
    };
  }

  /**
   * 把分类实体和累计金额转换成分类汇总响应。
   * colorSource 表示最终背景色来自哪个分类，默认使用当前分类。
   * @param category 用户分类
   * @param amountCents 改分类下的金额
   * @param colorSource 分类背景色来源
   * @returns 一个分类的数据结构
   */
  private assembleCategorySummary(
    category: UserCategoryEntity,
    amountCents: bigint,
    colorSource: UserCategoryEntity = category,
  ): CategorySummaryItem {
    if (!colorSource.icon) {
      throw new InternalServerErrorException(
        `分类 ${colorSource.id} 未查询到图标信息`,
      );
    }

    return {
      id: category.id,
      name: category.name,
      iconKey: category.iconKey,
      backgroundColor: colorSource.icon.backgroundColor,

      // 已归档分类仍参与历史汇总，只返回其归档状态。
      archived: category.archivedTime !== null,

      amount: centsToAmount(amountCents),
    };
  }

  /** 按“月份 → 一级分类 → 二级分类”组装筛选后的汇总。 */
  private assembleMonthlySummary(
    transactions: TransactionEntity[],
  ): MonthlySummaryGroup[] {
    const monthMap = new Map<number, MonthlySummaryAccumulator>();

    for (const transaction of transactions) {
      // 使用实际发生日期分组，而不是创建日期。
      // 月份可以转为 number，金额仍使用 bigint。
      const monthNumber = Number(
        toDateKey(transaction.occurredDate).slice(5, 7),
      );
      const amountCents = amountToCents(transaction.amount);
      const category = transaction.category;

      if (!category) {
        throw new InternalServerErrorException(
          `流水 ${transaction.id} 未查询到分类信息`,
        );
      }

      let monthGroup = monthMap.get(monthNumber);

      // 第一次遇到该月份时，初始化累计容器。
      if (!monthGroup) {
        monthGroup = {
          month: monthNumber,
          expenseCents: 0n,
          incomeCents: 0n,
          expenseCategories: new Map(),
          incomeCategories: new Map(),
        };

        monthMap.set(monthNumber, monthGroup);
      }

      if (transaction.type === TransactionType.EXPENSE) {
        const primaryCategory = category.parent;

        // 支出必须绑定二级分类，并且存在支出一级分类。
        // 遇到异常关联时直接报错，避免组装出错误的分类层级。
        if (
          category.level !== 2 ||
          category.type !== TransactionType.EXPENSE ||
          !primaryCategory ||
          primaryCategory.level !== 1 ||
          primaryCategory.type !== TransactionType.EXPENSE
        ) {
          throw new InternalServerErrorException(
            `支出流水 ${transaction.id} 的分类层级或类型异常`,
          );
        }

        // 累加该月份的支出。
        monthGroup.expenseCents += amountCents;

        let primaryGroup = monthGroup.expenseCategories.get(primaryCategory.id);

        // 第一次遇到该一级分类时，创建分类累计容器。
        if (!primaryGroup) {
          primaryGroup = {
            category: primaryCategory,
            amountCents: 0n,
            children: new Map(),
          };

          monthGroup.expenseCategories.set(primaryCategory.id, primaryGroup);
        }

        let secondaryGroup = primaryGroup.children.get(category.id);

        if (!secondaryGroup) {
          secondaryGroup = {
            category,
            amountCents: 0n,
          };

          primaryGroup.children.set(category.id, secondaryGroup);
        }

        // 同一笔支出分别计入父分类和子分类。
        // 每个层级内只累计一次，父分类金额等于子分类金额之和。
        primaryGroup.amountCents += amountCents;
        secondaryGroup.amountCents += amountCents;
      } else if (transaction.type === TransactionType.INCOME) {
        // 收入只汇总一级分类，不创建二级分类数组。
        if (category.level !== 1 || category.type !== TransactionType.INCOME) {
          throw new InternalServerErrorException(
            `收入流水 ${transaction.id} 的分类层级或类型异常`,
          );
        }

        monthGroup.incomeCents += amountCents;

        let incomeGroup = monthGroup.incomeCategories.get(category.id);

        if (!incomeGroup) {
          incomeGroup = {
            category,
            amountCents: 0n,
          };

          monthGroup.incomeCategories.set(category.id, incomeGroup);
        }

        incomeGroup.amountCents += amountCents;
      } else {
        throw new InternalServerErrorException(
          `流水 ${transaction.id} 的收支类型异常`,
        );
      }
    }

    // 分类按照用户设置的 sortOrder、id 排序。
    // Map 的插入顺序来自流水，不能直接作为分类展示顺序。
    const compareCategories = (
      left: CategoryAmountAccumulator,
      right: CategoryAmountAccumulator,
    ): number =>
      left.category.sortOrder - right.category.sortOrder ||
      left.category.id - right.category.id;

    return (
      Array.from(monthMap.values())

        // 月份倒序排列。
        .sort((left, right) => right.month - left.month)
        .map((monthGroup) => ({
          month: monthGroup.month,

          // bigint 只用于内部计算，响应转换成两位小数字符串。
          expenseTotal: centsToAmount(monthGroup.expenseCents),
          incomeTotal: centsToAmount(monthGroup.incomeCents),

          expenseCategories: Array.from(monthGroup.expenseCategories.values())
            .sort(compareCategories)
            .map((primaryGroup) => ({
              ...this.assembleCategorySummary(
                primaryGroup.category,
                primaryGroup.amountCents,
              ),

              children: Array.from(primaryGroup.children.values())
                .sort(compareCategories)
                .map((secondaryGroup) =>
                  this.assembleCategorySummary(
                    secondaryGroup.category,
                    secondaryGroup.amountCents,

                    // 二级分类背景色继承一级分类。
                    primaryGroup.category,
                  ),
                ),
            })),

          incomeCategories: Array.from(monthGroup.incomeCategories.values())
            .sort(compareCategories)
            .map((incomeGroup) =>
              this.assembleCategorySummary(
                incomeGroup.category,
                incomeGroup.amountCents,
              ),
            ),
        }))
    );
  }

  /** 将创建流水时的可选文本统一处理成非空字符串或 NULL。 */
  private normalizeTransactionText(
    value: string | null | undefined,
    fieldName: string,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName}必须是字符串`);
    }

    const text = value.trim();

    // 按字符计数，避免将一个表情符号的两个 UTF-16 编码单元计为两个字符。
    if (Array.from(text).length > maxLength) {
      throw new BadRequestException(`${fieldName}不能超过${maxLength}个字符`);
    }

    return text === '' ? null : text;
  }

  /**
   * 校验并规范化创建参数，在开启数据库事务前拒绝无效输入。
   * 保留服务层校验，确保非 HTTP 调用也遵守创建约束。
   */
  private validateCreateTransactionParams(
    userId: number,
    type: TransactionType,
    categoryId: number,
    amount: string,
    occurredDate: string,
    title?: string | null,
    tagIds?: number[],
    remark?: string | null,
  ): CreateTransactionData {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('用户id必须是正整数');
    }

    if (type !== TransactionType.EXPENSE && type !== TransactionType.INCOME) {
      throw new BadRequestException('流水类型不正确');
    }

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      throw new BadRequestException('分类id必须是正整数');
    }

    // 必须先检查格式再转换成分，不能让数据库截断或四舍五入多余的小数。
    // DECIMAL(15,2) 最多容纳13位整数；金额计算全程使用 bigint，避免浮点误差。
    if (
      typeof amount !== 'string' ||
      amount.trim() !== amount ||
      !/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(amount)
    ) {
      throw new BadRequestException(
        '金额必须是最多13位整数和2位小数的金额字符串',
      );
    }

    const amountCents = amountToCents(amount);

    if (amountCents <= 0n) {
      throw new BadRequestException('金额必须大于0');
    }

    // MySQL DATE 支持1000至9999年；格式正确还不代表日期真实存在。
    if (
      typeof occurredDate !== 'string' ||
      !/^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(occurredDate)
    ) {
      throw new BadRequestException('发生日期必须是 YYYY-MM-DD 格式的有效日期');
    }

    const date = new Date(`${occurredDate}T00:00:00.000Z`);

    // Date 会把2月30日等日期自动顺延，必须与原始日期比较才能拒绝这种输入。
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== occurredDate
    ) {
      throw new BadRequestException('发生日期必须是有效的自然日期');
    }

    const normalizedTitle = this.normalizeTransactionText(title, '标题', 50);
    const normalizedRemark = this.normalizeTransactionText(remark, '备注', 100);

    if (
      tagIds !== undefined &&
      (!Array.isArray(tagIds) ||
        tagIds.some((tagId) => !Number.isSafeInteger(tagId) || tagId <= 0))
    ) {
      throw new BadRequestException('标签id必须是正整数数组');
    }

    // 关联表以“流水id + 标签id”为联合主键，先去重，避免重复绑定。
    return {
      ownerUserId: userId,
      type,
      categoryId,
      amount: centsToAmount(amountCents),
      occurredDate,
      title: normalizedTitle,
      remark: normalizedRemark,
      tagIds: [...new Set(tagIds ?? [])],
    };
  }

  /** 在当前事务中校验分类、标签的归属、归档状态和分类收支规则。 */
  private async validateCreateTransactionRelations(
    manager: EntityManager,
    data: CreateTransactionData,
  ): Promise<void> {
    const { ownerUserId, type, categoryId, tagIds } = data;
    const categoryRepo = manager.getRepository(UserCategoryEntity);

    const category = await categoryRepo.findOne({
      where: {
        id: categoryId,
        ownerUserId,
        archivedTime: IsNull(),
      },
      // 共享锁保持到事务结束，防止校验通过后分类被其他请求归档。
      lock: { mode: 'pessimistic_read' },
    });

    if (!category) {
      throw new BadRequestException('分类不存在或已归档');
    }

    const requiredLevel = type === TransactionType.EXPENSE ? 2 : 1;

    if (category.type !== type || category.level !== requiredLevel) {
      throw new BadRequestException(
        '支出必须绑定支出二级分类，收入必须绑定收入一级分类',
      );
    }

    if (tagIds.length > 0) {
      const tagRepo = manager.getRepository(TagEntity);
      const tags = await tagRepo.find({
        select: { id: true },
        where: {
          id: In(tagIds),
          ownerUserId,
          archivedTime: IsNull(),
        },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_read' },
      });

      // 查询已经限定用户归属和未归档状态，数量不一致就表示有不可用标签。
      if (tags.length !== tagIds.length) {
        throw new BadRequestException('标签不存在或已归档');
      }
    }
  }

  /** 将规范化后的数据映射为流水实体。 */
  private buildTransactionEntity(
    transactionRepo: Repository<TransactionEntity>,
    data: CreateTransactionData,
  ): TransactionEntity {
    return transactionRepo.create({
      ownerUserId: data.ownerUserId,
      type: data.type,
      categoryId: data.categoryId,
      amount: data.amount,
      title: data.title,
      remark: data.remark,
      // 直接保存日期字符串，避免时区转换改变实际发生日期。
      occurredDate: data.occurredDate,
      archivedTime: null,
    });
  }

  /** 在当前事务中绑定已有标签，只新增关联记录。 */
  private async bindTransactionTags(
    manager: EntityManager,
    transactionId: number,
    tagIds: number[],
  ): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }

    const transactionTagRepo = manager.getRepository(TransactionTagEntity);
    const transactionTags = tagIds.map((tagId) =>
      transactionTagRepo.create({ transactionId, tagId }),
    );

    await transactionTagRepo.save(transactionTags);
  }

  /**
   * 创建流水并绑定已有标签；成功后由前端重新查询账单，不返回流水数据。
   * @param userId 当前登录用户id，由认证上下文提供
   * @param type 流水类型：支出或收入
   * @param categoryId 支出二级分类id或收入一级分类id
   * @param amount 大于0的金额字符串，最多13位整数和2位小数
   * @param occurredDate 实际发生日期，格式为 YYYY-MM-DD
   * @param title 流水标题
   * @param tagIds 已有标签id，不传或空数组表示不绑定标签
   * @param remark 补充备注
   */
  async createTransaction(
    userId: number,
    type: TransactionType,
    categoryId: number,
    amount: string,
    occurredDate: string,
    title?: string | null,
    tagIds?: number[],
    remark?: string | null,
  ): Promise<void> {
    // 1. 校验并规范化参数。
    const data = this.validateCreateTransactionParams(
      userId,
      type,
      categoryId,
      amount,
      occurredDate,
      title,
      tagIds,
      remark,
    );

    try {
      // 关联校验和全部写入共用事务 manager，保证锁与事务边界一致。
      await this.transactionRepo.manager.transaction(async (manager) => {
        await this.validateCreateTransactionRelations(manager, data);

        // 2. 创建实体。
        const transactionRepo = manager.getRepository(TransactionEntity);
        const transaction = this.buildTransactionEntity(transactionRepo, data);

        // 3. 保存流水，取得数据库生成的id。
        const savedTransaction = await transactionRepo.save(transaction);

        // 4. 关联流水与标签。
        await this.bindTransactionTags(
          manager,
          savedTransaction.id,
          data.tagIds,
        );

        // 回调正常结束时自动提交；任一步抛出异常时自动回滚流水和全部关联。
      });
    } catch (error) {
      // 保留业务校验的400错误，数据库异常才统一转换成创建失败。
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('创建流水失败，请重新尝试', {
        cause: error,
      });
    }
  }
}
