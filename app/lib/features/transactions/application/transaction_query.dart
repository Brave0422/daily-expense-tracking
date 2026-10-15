import 'package:freezed_annotation/freezed_annotation.dart';

import '../../categories/data/category.dart';

part 'transaction_query.freezed.dart';

/// 不可变查询标识，Riverpod 根据条件隔离并取消旧结果。
@freezed
abstract class TransactionQuery with _$TransactionQuery {
  /// 建立查询。[period] 为月或年；[monthly] 表示年内月汇总；[type] 为可选方向；
  /// [categoryIds]、[tagIds] 为真实主键；[minAmount]、[maxAmount] 为元；
  /// [title]、[remark] 只在日明细中使用。
  const factory TransactionQuery({
    /// 当前模式的周期字符串。
    required String period,

    /// false 为日明细，true 为年内月汇总。
    @Default(false) bool monthly,

    /// null 表示全部，序列化时省略。
    EntryType? type,

    /// 历史分类筛选主键。
    @Default([]) List<int> categoryIds,

    /// 日明细任一标签匹配主键。
    @Default([]) List<int> tagIds,

    /// 非负最小金额字符串，空时省略。
    @Default('') String minAmount,

    /// 非负最大金额字符串，空时省略。
    @Default('') String maxAmount,

    /// 日明细标题关键词。
    @Default('') String title,

    /// 日明细备注关键词。
    @Default('') String remark,
  }) = _TransactionQuery;

  /// 支持生成模型的自定义白名单序列化方法。
  const TransactionQuery._();

  /// 仅构造当前端点允许的字段，隐藏字段即使有草稿也不发送。
  Map<String, dynamic> toQuery() => {
    monthly ? 'year' : 'month': period,
    if (type != null) 'type': type?.name,
    if (categoryIds.isNotEmpty) 'categoryIds': categoryIds,
    if (minAmount.isNotEmpty) 'minAmount': minAmount,
    if (maxAmount.isNotEmpty) 'maxAmount': maxAmount,
    if (!monthly && tagIds.isNotEmpty) 'tagIds': tagIds,
    if (!monthly && title.trim().isNotEmpty) 'title': title.trim(),
    if (!monthly && remark.trim().isNotEmpty) 'remark': remark.trim(),
  };

  /// 是否应用了非默认筛选，用于区分周期空结果与筛选无匹配。
  bool get filtered => toQuery().length > 1;
}
