import 'package:freezed_annotation/freezed_annotation.dart';

part 'statistics.freezed.dart';
part 'statistics.g.dart';

/// 同名二级分类的父级展示。
@freezed
abstract class StatisticsParent with _$StatisticsParent {
  /// [categoryId] 为父类主键；[name] 为父级名称。
  const factory StatisticsParent({
    /// 父分类真实主键。
    required int categoryId,

    /// 父分类当前名称。
    required String name,
  }) = _StatisticsParent;

  /// 从 [json] 解析父类。
  factory StatisticsParent.fromJson(Map<String, dynamic> json) =>
      _$StatisticsParentFromJson(json);
}

/// 分类统计项，金额与百分比文案均保留接口精度。
@freezed
abstract class StatisticsItem with _$StatisticsItem {
  /// [categoryId] 为主键；[name]、[iconKey]、[backgroundColor] 为分类展示；
  /// [amount] 为元；[percentage] 不含百分号；[parent] 一级时为空。
  const factory StatisticsItem({
    /// 稳定图表配色的主键。
    required int categoryId,

    /// 分类名称。
    required String name,

    /// 分类资源映射键。
    required String iconKey,

    /// 分类图标背景，与图表配色分开。
    required String backgroundColor,

    /// 精确金额字符串。
    required String amount,

    /// 后端百分比，例如 12.50。
    required String percentage,

    /// 二级分类所属父级。
    StatisticsParent? parent,
  }) = _StatisticsItem;

  /// 从 [json] 读取排行或占比项。
  factory StatisticsItem.fromJson(Map<String, dynamic> json) =>
      _$StatisticsItemFromJson(json);
}

/// 趋势完整周期上的点，包括零值和未来日期。
@freezed
abstract class TrendPoint with _$TrendPoint {
  /// [date] 为日期或月份；[amount] 为原始元字符串。
  const factory TrendPoint({
    /// YYYY-MM-DD 或 YYYY-MM 坐标标签。
    required String date,

    /// 精确金额，仅绘图时转 double。
    required String amount,
  }) = _TrendPoint;

  /// 从 [json] 读取时间轴。
  factory TrendPoint.fromJson(Map<String, dynamic> json) =>
      _$TrendPointFromJson(json);
}

/// 统计公共响应，Repository 按端点验证 items / series，避免损坏结果变成空图表。
@freezed
abstract class StatisticsResult with _$StatisticsResult {
  /// [period]、[periodType]、[type] 为上下文；[transactionCount] 为笔数；
  /// [totalAmount] 为总额；[categoryLevel]、[order]、[items] 为分类板块；
  /// [previousPeriod]、[previousTotalAmount]、[changeRate]、[changeStatus]、[series] 为趋势。
  const factory StatisticsResult({
    /// 查询月份或年份。
    required String period,

    /// month / year。
    required String periodType,

    /// expense / income。
    required String type,

    /// 本期流水笔数。
    required int transactionCount,

    /// 接口计算的本期总金额。
    required String totalAmount,

    /// 分类统计的一级 / 二级。
    int? categoryLevel,

    /// 排行 asc / desc。
    String? order,

    /// 分类统计完整列表。
    List<StatisticsItem>? items,

    /// 上一完整自然周期。
    String? previousPeriod,

    /// 上期精确金额。
    String? previousTotalAmount,

    /// 后端变化百分比，new 时可为空。
    String? changeRate,

    /// increase / decrease / unchanged / new 决定文案方向。
    String? changeStatus,

    /// 完整周期时间轴。
    List<TrendPoint>? series,
  }) = _StatisticsResult;

  /// 从 [json] 读取统计响应。
  factory StatisticsResult.fromJson(Map<String, dynamic> json) =>
      _$StatisticsResultFromJson(json);
}
