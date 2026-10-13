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

// 一天的内部累计结果。
interface DailyTransactionAccumulator {
  date: string;
  expenseCents: bigint;
  incomeCents: bigint;
  transactions: DailyTransactionItem[];
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
  /**
   * 初始化 TransactionsService 的依赖。
   *
   * @param transactionRepo 流水实体仓库，提供查询及事务入口
   * @param userCategoryRepo 用户分类实体仓库
   * @param tagRepo 标签实体仓库
   */
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
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param type 可选收支类型；不传时同时查询支出和收入
   * @param categoryIds 可选分类id数组；支出一级分类匹配其下全部二级分类
   * @param tagIds 可选标签id数组；包含任一所选标签即匹配，仅日明细支持
   * @param minAmount 可选最小金额字符串，包含边界值
   * @param maxAmount 可选最大金额字符串，包含边界值
   * @param month 查询月份，格式为 YYYY-MM；与 year 互斥
   * @param year 查询年份，格式为 YYYY；与 month 互斥
   * @returns 筛选条件合法时异步结束，无返回值；参数或关联不合法时抛出异常
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
   * 将月份转换为查询使用的左闭右开日期范围。
   *
   * @param month 查询月份，格式为 YYYY-MM
   * @returns 当月1日 startDate 和下月1日 endDate，均为 YYYY-MM-DD 字符串
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
   * 将年份转换为查询使用的左闭右开日期范围。
   *
   * @param year 查询年份，格式为 YYYY
   * @returns 当年1月1日 startDate 和次年1月1日 endDate，均为 YYYY-MM-DD 字符串
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
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param type 可选收支类型；不传时同时查询支出和收入
   * @param categoryIds 可选分类id数组；支出一级分类匹配其下全部二级分类
   * @param tagIds 可选标签id数组；包含任一所选标签即匹配，仅日明细支持
   * @param title 可选标题包含搜索，仅日明细支持
   * @param remark 可选备注包含搜索，仅日明细支持
   * @param minAmount 可选最小金额字符串，包含边界值
   * @param maxAmount 可选最大金额字符串，包含边界值
   * @param month 查询月份，格式为 YYYY-MM；与 year 互斥
   * @param year 查询年份，格式为 YYYY；与 month 互斥
   * @returns 符合条件的流水实体列表及相同筛选口径的收入、支出合计
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
   * 统计当前用户在指定日期范围内的完整收支，不应用列表筛选条件。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param startDate 周期开始日期，包含当天，格式为 YYYY-MM-DD
   * @param endDate 周期结束日期，不包含当天，格式为 YYYY-MM-DD
   * @returns 固定两位小数的收入合计、支出合计及收入减支出的结余
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
   * 以一个自然月为周期查询日明细及两种统计口径。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param month 查询月份，格式为 YYYY-MM
   * @param type 可选收支类型；不传时同时查询支出和收入
   * @param categoryIds 可选分类id数组；支出一级分类匹配其下全部二级分类
   * @param tagIds 可选标签id数组；包含任一所选标签即匹配，仅日明细支持
   * @param title 可选标题包含搜索，仅日明细支持
   * @param remark 可选备注包含搜索，仅日明细支持
   * @param minAmount 可选最小金额字符串，包含边界值
   * @param maxAmount 可选最大金额字符串，包含边界值
   * @returns 月份、完整周期总览、筛选合计及按日期倒序排列的流水明细
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
    // 1. 按“指定月份 + 当前筛选条件”查询流水和筛选合计
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

    // 2. 获取指定月份的金额统计数据
    const { startDate, endDate } = this.getMonthDateRange(month);
    const { totalIncome, totalExpense, balance } =
      await this.calculatePeriodAmount(userId, startDate, endDate);

    // 3. 组装按日期分组的流水和每日收支合计
    const days = this.assembleDailyTransactions(filteredTransactions);

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
   * 按日期组装筛选后的流水明细，并累计每日收支。
   *
   * @param transactions 完整且已去重的筛选流水实体列表，包含分类、图标及全部标签
   * @returns 按日期倒序排列的分组，每组包含每日收支合计和流水明细
   */
  private assembleDailyTransactions(
    transactions: TransactionEntity[],
  ): DailyTransactionGroup[] {
    /*
     * Map 的 key 是日期。
     * 每遇到一条流水，就把它加入对应日期的分组，
     * 同时累加该日收入或支出。
     */
    const dayMap = new Map<string, DailyTransactionAccumulator>();

    for (const transaction of transactions) {
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
    return Array.from(dayMap.values()).map((day) => ({
      date: day.date,
      expenseTotal: centsToAmount(day.expenseCents),
      incomeTotal: centsToAmount(day.incomeCents),
      transactions: day.transactions,
    }));
  }

  /**
   * 以一个自然年为周期查询月份分类汇总及两种统计口径。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param year 查询年份，格式为 YYYY
   * @param type 可选收支类型；不传时同时查询支出和收入
   * @param categoryIds 可选分类id数组；支出一级分类匹配其下全部二级分类
   * @param minAmount 可选最小金额字符串，包含边界值
   * @param maxAmount 可选最大金额字符串，包含边界值
   * @returns 年份、完整周期总览、筛选合计及按月份倒序排列的分类汇总
   */
  async findMonthlySummary(
    userId: number,
    year: string,
    type?: TransactionType,
    categoryIds?: number[],
    minAmount?: string,
    maxAmount?: string,
  ): Promise<MonthlySummaryResult> {
    // 1. 按“指定年份 + 当前筛选条件”查询流水和筛选合计，年周期不支持标签、标题、备注
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

    // 2. 获取指定年份的金额统计数据
    const { startDate, endDate } = this.getYearDateRange(year);
    const { totalIncome, totalExpense, balance } =
      await this.calculatePeriodAmount(userId, startDate, endDate);

    // 3. 组装数据
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
   * 把分类实体和以分累计的金额转换成分类汇总响应。
   *
   * @param category 需要展示的分类实体
   * @param amountCents 当前分类下累计的金额，以分为单位的 bigint
   * @param colorSource 背景色来源分类，默认使用当前分类；支出二级分类传入父分类
   * @returns 包含分类名称、图标、背景色及两位小数金额的分类汇总项
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

  /**
   * 按月份、一级分类和二级分类组装筛选后的汇总。
   *
   * @param transactions 完整且已去重的筛选流水实体列表，包含分类及父分类图标
   * @returns 按月份倒序排列的分组，包含收支合计和按展示顺序排列的分类汇总
   */
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
    /**
     * 按分类的展示顺序排序，相同排序值时按id稳定排序。
     *
     * @param left 参与比较的第一个分类累计项
     * @param right 参与比较的第二个分类累计项
     * @returns 负数表示 left 在前，0表示顺序相同，正数表示 right 在前
     */
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

  /**
   * 将流水文本统一处理成非空字符串或 NULL。
   *
   * @param value 原始标题或备注；支持字符串、null 和 undefined
   * @returns 去除首尾空格后的非空字符串；空文本或未提供时返回 null
   */
  private normalizeTransactionText(
    value: string | null | undefined,
  ): string | null {
    return value?.trim() || null;
  }

  /**
   * 校验用户id并规范化创建数据，字段格式和范围由 DTO 校验。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param type 流水类型，expense 表示支出，income 表示收入
   * @param categoryId 支出二级分类id或收入一级分类id
   * @param amount 大于0的金额字符串，最多13位整数和2位小数
   * @param occurredDate 实际发生日期，格式为 YYYY-MM-DD
   * @param title 流水标题，空文本规范化为 NULL
   * @param tagIds 已有标签id数组，去重后建立关联
   * @param remark 补充备注，空文本规范化为 NULL
   * @returns 金额及文本已标准化、标签id已去重的创建数据
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

    // 关联表以“流水id + 标签id”为联合主键，先去重，避免重复绑定。
    return {
      ownerUserId: userId,
      type,
      categoryId,
      amount: normalizeAmount(amount),
      occurredDate,
      title: this.normalizeTransactionText(title),
      remark: this.normalizeTransactionText(remark),
      tagIds: [...new Set(tagIds ?? [])],
    };
  }

  /**
   * 在当前事务中校验分类和标签的归属、归档状态及分类收支规则。
   *
   * @param manager 当前数据库事务的实体管理器，关联查询及锁共用该事务
   * @param data 已规范化的创建数据，包含用户、类型、分类和标签id
   * @returns 全部关联合法时异步结束，无返回值；不可用时抛出异常
   */
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

  /**
   * 将规范化后的创建数据映射为尚未保存的流水实体。
   *
   * @param transactionRepo 当前事务中的流水仓库
   * @param data 金额、文本和日期已规范化的创建数据
   * @returns 尚未持久化的流水实体，不包含标签关联记录
   */
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

  /**
   * 在当前事务中绑定已有标签，只新增指定的关联记录。
   *
   * @param manager 当前数据库事务的实体管理器
   * @param transactionId 已创建或已锁定的当前用户流水id
   * @param tagIds 已去重且通过可用性校验的待新增标签id；空数组不执行写入
   * @returns 新增标签关联保存完成后异步结束，无返回值
   */
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
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param type 流水类型，expense 表示支出，income 表示收入
   * @param categoryId 支出二级分类id或收入一级分类id
   * @param amount 大于0的金额字符串，最多13位整数和2位小数
   * @param occurredDate 实际发生日期，格式为 YYYY-MM-DD
   * @param title 可选流水标题，空文本或未提供时保存为 NULL
   * @param tagIds 可选已有标签id；不传或空数组表示不绑定标签
   * @param remark 可选备注，空文本或未提供时保存为 NULL
   * @returns 流水和全部标签关联提交成功后异步结束，无返回值；失败时回滚并抛出异常
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

  /**
   * 校验编辑后的分类和标签，允许保留原有已归档关联。
   *
   * @param manager 当前数据库事务的实体管理器
   * @param transaction 已校验归属和未删除状态并加锁的原流水实体
   * @param categoryId 编辑后的分类id，必须符合原流水类型和分类层级
   * @param tagIds 去重后的完整标签id集合
   * @param originalTagIds 原流水已绑定的标签id集合，用于区分保留项和新增项
   * @returns 全部关联合法时异步结束，无返回值；越权、类型不符或新绑定归档项时抛出异常
   */
  private async validateUpdateTransactionRelations(
    manager: EntityManager,
    transaction: TransactionEntity,
    categoryId: number,
    tagIds: number[],
    originalTagIds: Set<number>,
  ): Promise<void> {
    // 原分类未变时允许它已经归档；更换分类时才要求 archivedTime 为 NULL。
    // 两种情况都检查用户归属，防止把其他用户的分类关联到这条流水。
    const category = await manager.getRepository(UserCategoryEntity).findOne({
      where: {
        id: categoryId,
        ownerUserId: transaction.ownerUserId,
        ...(categoryId === transaction.categoryId
          ? {}
          : { archivedTime: IsNull() }),
      },
      lock: { mode: 'pessimistic_read' },
    });

    if (!category) {
      throw new BadRequestException('分类不存在或已归档');
    }

    // 收支方向始终取数据库中的原类型，客户端不能通过更换分类改变流水类型。
    const requiredLevel = transaction.type === TransactionType.EXPENSE ? 2 : 1;
    if (
      category.type !== transaction.type ||
      category.level !== requiredLevel
    ) {
      throw new BadRequestException(
        '支出必须绑定支出二级分类，收入必须绑定收入一级分类',
      );
    }

    if (tagIds.length === 0) {
      return;
    }

    // 查询完整的新标签集合，不提前排除归档项，才能识别允许保留的历史标签。
    const tags = await manager.getRepository(TagEntity).find({
      select: { id: true, archivedTime: true },
      where: { id: In(tagIds), ownerUserId: transaction.ownerUserId },
      order: { id: 'ASC' },
      // 与创建流水一样，保持共享锁到事务结束，避免校验后标签被并发归档。
      lock: { mode: 'pessimistic_read' },
    });

    // 数量不一致表示存在无效或越权标签；归档标签只有在旧集合中才允许保留。
    if (
      tags.length !== tagIds.length ||
      tags.some(
        (tag) => tag.archivedTime !== null && !originalTagIds.has(tag.id),
      )
    ) {
      throw new BadRequestException('标签不存在或已归档');
    }
  }

  /**
   * 更新当前用户的未删除流水及标签关联，流水类型不可修改。
   *
   * @param userId 当前登录用户id，由认证上下文提供
   * @param transactionId 需要编辑的流水id
   * @param categoryId 支出二级分类id或收入一级分类id
   * @param amount 大于0的金额字符串，最多13位整数和2位小数
   * @param occurredDate 实际发生日期，格式为 YYYY-MM-DD
   * @param title 流水标题，空文本规范化为 NULL
   * @param tagIds 编辑后的完整标签id集合；空数组表示移除全部标签
   * @param remark 补充备注，空文本规范化为 NULL
   * @returns 流水和标签差异更新提交成功后异步结束，无响应数据；失败时回滚并抛出异常
   */
  async updateTransaction(
    userId: number,
    transactionId: number,
    categoryId: number,
    amount: string,
    occurredDate: string,
    title: string | null,
    tagIds: number[],
    remark: string | null,
  ): Promise<void> {
    // 1. DTO 校验完整请求的格式；服务层校验认证用户和路径id。
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('用户id必须是正整数');
    }
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      throw new BadRequestException('流水id必须是正整数');
    }

    // 标签关联使用联合主键，先去重，避免同一标签被重复绑定。
    const uniqueTagIds = [...new Set(tagIds)];

    try {
      // 后续查询、锁和写入都使用当前事务 manager，确保任一步失败都能整体回滚。
      await this.transactionRepo.manager.transaction(async (manager) => {
        const transactionRepo = manager.getRepository(TransactionEntity);
        // 2. 查询并锁定原流水；其他请求修改或删除同一行时必须等待事务结束。
        const transaction = await transactionRepo.findOne({
          where: {
            id: transactionId,
            ownerUserId: userId,
            archivedTime: IsNull(),
          },
          lock: { mode: 'pessimistic_write' },
        });

        // 不区分不存在、其他用户的记录和已删除记录，避免泄露归属信息。
        if (!transaction) {
          throw new BadRequestException('流水记录不存在');
        }

        // 读取旧标签作为差异计算的基准，并用于判断归档标签是否原本已经绑定。
        // 关联表没有用户字段，这里的流水id已在上一步完成归属校验并加锁。
        const transactionTagRepo = manager.getRepository(TransactionTagEntity);
        const originalTags = await transactionTagRepo.find({
          select: { tagId: true },
          where: { transactionId },
          order: { tagId: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        const originalTagIds = new Set(originalTags.map((tag) => tag.tagId));

        // 3. 先校验新分类和完整标签集合，通过后才允许执行写入。
        await this.validateUpdateTransactionRelations(
          manager,
          transaction,
          categoryId,
          uniqueTagIds,
          originalTagIds,
        );

        // 4. UPDATE 再次限定流水id、用户归属和未删除状态，只更新可编辑字段。
        // 金额经整数分转换为两位小数字符串；空标题和备注统一保存为 NULL。
        const result = await transactionRepo.update(
          { id: transactionId, ownerUserId: userId, archivedTime: IsNull() },
          {
            categoryId,
            amount: normalizeAmount(amount),
            occurredDate,
            title: this.normalizeTransactionText(title),
            remark: this.normalizeTransactionText(remark),
          },
        );

        // 参数合法不代表写入成功；必须确认只更新了一行，否则抛错触发回滚。
        if (result.affected !== 1) {
          throw new InternalServerErrorException('编辑流水失败，请重新尝试');
        }

        // 5. 计算标签差异：旧 [3, 5]、新 [3, 9] 时，只删除5、新增9，保留3。
        // 保留项不重新插入，原有已归档标签的历史关联因此也不会被改写。
        const nextTagIds = new Set(uniqueTagIds);
        const removedTagIds = [...originalTagIds].filter(
          (tagId) => !nextTagIds.has(tagId),
        );
        const addedTagIds = uniqueTagIds.filter(
          (tagId) => !originalTagIds.has(tagId),
        );

        if (removedTagIds.length > 0) {
          await transactionTagRepo.delete({
            transactionId,
            tagId: In(removedTagIds),
          });
        }
        await this.bindTransactionTags(manager, transactionId, addedTagIds);

        // 6. 回调正常结束时 TypeORM 提交事务；流水或标签任一步抛错时整体回滚。
      });
    } catch (error) {
      // 事务回滚后再处理响应：保留明确的业务错误，数据库异常转为统一编辑失败。
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('编辑流水失败，请重新尝试', {
        cause: error,
      });
    }
  }
}
