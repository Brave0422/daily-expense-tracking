import 'package:freezed_annotation/freezed_annotation.dart';

import '../../categories/data/category.dart';
import '../../tags/data/tag.dart';

part 'transaction.freezed.dart';
part 'transaction.g.dart';

/// 流水分类历史关联，收入的 secondary 为空。
@freezed
abstract class TransactionCategory with _$TransactionCategory {
  /// [primary] 为一级；[secondary] 为支出实际二级或收入 null。
  const factory TransactionCategory({
    /// 必有的一级分类历史信息。
    required Category primary,

    /// 收入不提供二级分类。
    Category? secondary,
  }) = _TransactionCategory;

  /// 从 [json] 解析完整关联，不将归档分类当作缺失。
  factory TransactionCategory.fromJson(Map<String, dynamic> json) =>
      _$TransactionCategoryFromJson(json);
}

/// 日明细已有流水，用于独立编辑草稿回填。
@freezed
abstract class TransactionItem with _$TransactionItem {
  /// [id] 为流水主键；[type] 编辑不可修改；[amount] 为精确元字符串；
  /// [occurredDate] 为自然日期；[category] 为历史关联；[title] 和 [remark]
  /// 可清空；[tags] 包括已有归档关联。
  const factory TransactionItem({
    /// 服务端流水主键。
    required int id,

    /// 收支方向。
    required EntryType type,

    /// 人民币元字符串，不通过浮点回填。
    required String amount,

    /// YYYY-MM-DD 业务自然日期。
    required String occurredDate,

    /// 一、二级分类历史展示。
    required TransactionCategory category,

    /// 可选标题。
    String? title,

    /// 可选备注。
    String? remark,

    /// 当前记录关联的完整标签集合。
    required List<Tag> tags,
  }) = _TransactionItem;

  /// 从 [json] 解析记录；未提供必需列表时报错，不能伪造空记录。
  factory TransactionItem.fromJson(Map<String, dynamic> json) =>
      _$TransactionItemFromJson(json);
}

/// 周期总览或筛选合计，均取后端精确计算结果。
@freezed
abstract class Totals with _$Totals {
  /// [expense]、[income] 单位元；[balance] 只在完整周期 totals 中提供。
  const factory Totals({
    /// 后端支出合计。
    required String expense,

    /// 后端收入合计。
    required String income,

    /// 完整周期结余；筛选合计不包含此字段。
    String? balance,
  }) = _Totals;

  /// 从 [json] 解析合计，禁止本地代算。
  factory Totals.fromJson(Map<String, dynamic> json) => _$TotalsFromJson(json);
}

/// 按日分组的匹配流水。
@freezed
abstract class DailyGroup with _$DailyGroup {
  /// [date] 为自然日；[expenseTotal]、[incomeTotal] 为分组合计；
  /// [transactions] 按服务端顺序展示。
  const factory DailyGroup({
    /// 本组日期。
    required String date,

    /// 匹配筛选的当日支出。
    required String expenseTotal,

    /// 匹配筛选的当日收入。
    required String incomeTotal,

    /// 返回的全部流水，接口无分页。
    required List<TransactionItem> transactions,
  }) = _DailyGroup;

  /// 从 [json] 解析分组。
  factory DailyGroup.fromJson(Map<String, dynamic> json) =>
      _$DailyGroupFromJson(json);
}

/// 年内月汇总，不从日明细自行聚合。
@freezed
abstract class MonthlyGroup with _$MonthlyGroup {
  /// [month] 为 1–12；[expenseTotal]、[incomeTotal] 为匹配合计；
  /// [expenseCategories] 含子类；[incomeCategories] 仅一级。
  const factory MonthlyGroup({
    /// 年内月份编号。
    required int month,

    /// 筛选后的本月支出。
    required String expenseTotal,

    /// 筛选后的本月收入。
    required String incomeTotal,

    /// 一级 / 二级支出汇总。
    required List<Category> expenseCategories,

    /// 一级收入汇总。
    required List<Category> incomeCategories,
  }) = _MonthlyGroup;

  /// 从 [json] 解析月汇总。
  factory MonthlyGroup.fromJson(Map<String, dynamic> json) =>
      _$MonthlyGroupFromJson(json);
}

/// 日明细查询响应。
@freezed
abstract class DailyResult with _$DailyResult {
  /// [period] 为查询月份；[totals] 为全周期；[filterTotals] 为筛选；[days] 为结果。
  const factory DailyResult({
    /// YYYY-MM 查询上下文。
    required String period,

    /// 全月收支及结余。
    required Totals totals,

    /// 当前筛选收支。
    required Totals filterTotals,

    /// 按返回顺序的日分组。
    required List<DailyGroup> days,
  }) = _DailyResult;

  /// 从 [json] 读取日明细。
  factory DailyResult.fromJson(Map<String, dynamic> json) =>
      _$DailyResultFromJson(json);
}

/// 月汇总查询响应。
@freezed
abstract class MonthlyResult with _$MonthlyResult {
  /// [period] 为年份；[totals] 为全年；[filterTotals] 为筛选；[months] 为月分组。
  const factory MonthlyResult({
    /// YYYY 查询上下文。
    required String period,

    /// 全年精确收支及结余。
    required Totals totals,

    /// 筛选后的全年收支。
    required Totals filterTotals,

    /// 按接口顺序的月汇总。
    required List<MonthlyGroup> months,
  }) = _MonthlyResult;

  /// 从 [json] 读取月汇总。
  factory MonthlyResult.fromJson(Map<String, dynamic> json) =>
      _$MonthlyResultFromJson(json);
}
