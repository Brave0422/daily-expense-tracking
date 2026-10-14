/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 六个统计接口的独立查询 DTO，严格限定收支、汇总层级、周期和排序。
 */
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { TransactionType } from '../../transactions/enums/transaction-type-enum';
import type { CategoryLevel, StatisticsOrder } from '../statistics.types';
import { isValidStatisticsPeriod } from '../statistics.util';

@ValidatorConstraint({ name: 'statisticsMonth', async: false })
class StatisticsMonthConstraint implements ValidatorConstraintInterface {
  /**
   * @param value 查询月份原值
   * @returns 格式和本期、上期边界均有效时为 true
   */
  validate(value: unknown): boolean {
    return isValidStatisticsPeriod(value, 'month');
  }
  /**
   * @returns 月份格式及数据库边界错误说明
   */
  defaultMessage(): string {
    return '月份必须为 YYYY-MM，范围为 1000-02 至 9999-11';
  }
}
@ValidatorConstraint({ name: 'statisticsYear', async: false })
class StatisticsYearConstraint implements ValidatorConstraintInterface {
  /**
   * @param value 查询年份原值
   * @returns 四位年份及比较边界有效时为 true
   */
  validate(value: unknown): boolean {
    return isValidStatisticsPeriod(value, 'year');
  }
  /**
   * @returns 年份格式及数据库边界错误说明
   */
  defaultMessage(): string {
    return '年份必须为 YYYY，范围为 1001 至 9998';
  }
}
@ValidatorConstraint({ name: 'incomeCategoryLevel', async: false })
class IncomeCategoryLevelConstraint implements ValidatorConstraintInterface {
  /**
   * 防止收入请求二级分类，后端不静默修改非法条件。
   * @param value 转换后的分类层级
   * @param args 包含同一请求的流水类型
   * @returns 非收入或一级收入时为 true
   */
  validate(value: unknown, args: ValidationArguments): boolean {
    return (
      !('type' in args.object && args.object.type === TransactionType.INCOME) ||
      value === 1
    );
  }
  /**
   * @returns 收入层级约束说明
   */
  defaultMessage(): string {
    return '收入只支持一级分类统计';
  }
}

/**
 * 仅转换 HTTP 查询中的精确字符串 1、2，其他输入保留供校验拒绝。
 * @param params class-transformer 提供的原始字段值
 * @returns 数值层级或未经宽松转换的非法值
 */
function transformCategoryLevel(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return value === '1' ? 1 : value === '2' ? 2 : value;
}

export class StatisticsTypeQueryDto {
  @IsEnum(TransactionType, { message: '流水类型必须为 expense 或 income' })
  type!: TransactionType;
}
export class CategoryStatisticsQueryDto extends StatisticsTypeQueryDto {
  @Transform(transformCategoryLevel)
  @IsIn([1, 2], { message: '分类层级必须为 1 或 2' })
  @Validate(IncomeCategoryLevelConstraint)
  categoryLevel!: CategoryLevel;
}
export class MonthlyCategoryStatisticsQueryDto extends CategoryStatisticsQueryDto {
  @Validate(StatisticsMonthConstraint)
  month!: string;
}
export class YearlyCategoryStatisticsQueryDto extends CategoryStatisticsQueryDto {
  @Validate(StatisticsYearConstraint)
  year!: string;
}
export class MonthlyCategoryRankingQueryDto extends MonthlyCategoryStatisticsQueryDto {
  @IsIn(['asc', 'desc'], { message: '排序必须为 asc 或 desc' })
  order!: StatisticsOrder;
}
export class YearlyCategoryRankingQueryDto extends YearlyCategoryStatisticsQueryDto {
  @IsIn(['asc', 'desc'], { message: '排序必须为 asc 或 desc' })
  order!: StatisticsOrder;
}
export class MonthlyTransactionTrendQueryDto extends StatisticsTypeQueryDto {
  @Validate(StatisticsMonthConstraint)
  month!: string;
}
export class YearlyTransactionTrendQueryDto extends StatisticsTypeQueryDto {
  @Validate(StatisticsYearConstraint)
  year!: string;
}
