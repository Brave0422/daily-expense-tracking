import 'package:freezed_annotation/freezed_annotation.dart';

import '../../categories/data/category.dart';

part 'statistics_query.freezed.dart';

/// 统计三板块各自保留的查询条件。
@freezed
abstract class StatisticsQuery with _$StatisticsQuery {
  /// [panel] 为 ranking / proportion / trend；[month]、[year] 分别保留；
  /// [yearly] 选择周期；[type] 为方向；[level] 为支出层级；[ascending] 为排行顺序。
  const factory StatisticsQuery({
    /// 当前统计板块。
    required String panel,

    /// 保留的月份 YYYY-MM。
    required String month,

    /// 保留的年份 YYYY。
    required String year,

    /// true 查询完整自然年。
    @Default(false) bool yearly,

    /// 统计不提供全部收支。
    @Default(EntryType.expense) EntryType type,

    /// 支出一级 / 二级，收入序列化强制一级。
    @Default(1) int level,

    /// 仅排行使用，默认金额降序。
    @Default(false) bool ascending,
  }) = _StatisticsQuery;

  /// 支持自定义端点和白名单查询。
  const StatisticsQuery._();

  /// 精确映射六个既有统计端点。
  String get path =>
      '/statistics/${panel == 'trend' ? 'transaction-trend' : 'category-${panel == 'ranking' ? 'ranking' : 'proportion'}'}/${yearly ? 'yearly' : 'monthly'}';

  /// 按板块构造查询，不向严格统计端点发送多余字段。
  Map<String, dynamic> toQuery() => {
    'type': type.name,
    yearly ? 'year' : 'month': yearly ? year : month,
    if (panel != 'trend') 'categoryLevel': type == EntryType.income ? 1 : level,
    if (panel == 'ranking') 'order': ascending ? 'asc' : 'desc',
  };
}
