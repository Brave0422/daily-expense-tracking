/**
 * @author Brave
 * @date 2026-10-14T12:40:05+08:00
 * @description 自然周期边界、完整时间轴与基于整数分的精确百分比计算。
 */
import { BadRequestException } from '@nestjs/common';
import type { StatisticsPeriodType } from './statistics.types';

export interface StatisticsRange {
  period: string;
  periodType: StatisticsPeriodType;
  start: string;
  end: string;
  previousPeriod: string;
  previousStart: string;
}

/**
 * 检查周期及前后边界能否落在 MySQL DATE 的 1000 至 9999 年范围。
 * @param period 所选 YYYY-MM 或 YYYY 周期，不接受空值、数组或宽松格式
 * @param periodType 月或年周期
 * @returns 周期和比较边界均有效时返回 true
 */
export function isValidStatisticsPeriod(
  period: unknown,
  periodType: StatisticsPeriodType,
): period is string {
  if (typeof period !== 'string') return false;
  if (periodType === 'year') {
    return (
      period.length === 4 &&
      /^\d{4}$/.test(period) &&
      period >= '1001' &&
      period <= '9998'
    );
  }
  return (
    period.length === 7 &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(period) &&
    period >= '1000-02' &&
    period <= '9999-11'
  );
}

/**
 * 计算完整自然周期及上一周期，范围包含开始、不包含结束。
 * @param period 已选月份 YYYY-MM 或年份 YYYY
 * @param periodType 统计粒度
 * @returns 本期和上一期的有效数据库日期边界
 * @throws BadRequestException 周期格式或比较边界不在 MySQL DATE 范围内
 */
export function getStatisticsRange(
  period: string,
  periodType: StatisticsPeriodType,
): StatisticsRange {
  if (!isValidStatisticsPeriod(period, periodType)) {
    throw new BadRequestException('统计周期格式不正确或超出数据库日期范围');
  }
  const year = Number(period.slice(0, 4));
  if (periodType === 'year') {
    const previousPeriod = String(year - 1);
    return {
      period,
      periodType,
      previousPeriod,
      start: `${period}-01-01`,
      end: `${year + 1}-01-01`,
      previousStart: `${previousPeriod}-01-01`,
    };
  }
  const month = Number(period.slice(5));
  // 一月向前跨年，十二月向后跨年；字符串日期避免时区转换改变发生日期。
  const previousPeriod =
    month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, '0')}`;
  const nextPeriod =
    month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}`;
  return {
    period,
    periodType,
    previousPeriod,
    start: `${period}-01`,
    end: `${nextPeriod}-01`,
    previousStart: `${previousPeriod}-01`,
  };
}

/**
 * 生成整个自然月的每日日期或自然年的十二个月，不截断未来位置。
 * @param range 已验证的自然周期
 * @returns 按发生日期升序排列的 YYYY-MM-DD 或 YYYY-MM 时间轴
 */
export function createStatisticsTimeline(range: StatisticsRange): string[] {
  const length =
    range.periodType === 'year'
      ? 12
      : new Date(
          Date.UTC(
            Number(range.period.slice(0, 4)),
            Number(range.period.slice(5)),
            0,
          ),
        ).getUTCDate();
  return Array.from(
    { length },
    (_, index) => `${range.period}-${String(index + 1).padStart(2, '0')}`,
  );
}

/**
 * 计算有符号百分比，使用整数分四舍五入，避免大金额精度丢失和负零。
 * @param numerator 金额或差额，单位为分，允许负数
 * @param denominator 正数总金额，单位为分；零分母由调用方处理
 * @returns 两位小数的百分比字符串，不含百分号
 */
export function calculatePercentage(
  numerator: bigint,
  denominator: bigint,
): string {
  const absolute = numerator < 0n ? -numerator : numerator;
  // 放大到百分比的小数后两位；除法前增加半个分母实现四舍五入。
  const rounded = (absolute * 10000n + denominator / 2n) / denominator;
  const sign = numerator < 0n && rounded !== 0n ? '-' : '';
  return `${sign}${rounded / 100n}.${String(rounded % 100n).padStart(2, '0')}`;
}
