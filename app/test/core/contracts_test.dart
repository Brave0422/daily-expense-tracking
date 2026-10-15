import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/utils/values.dart';
import 'package:daily_expense_tracking/core/widgets/period_control.dart';
import 'package:daily_expense_tracking/features/categories/data/category.dart';
import 'package:daily_expense_tracking/features/statistics/application/statistics_query.dart';
import 'package:daily_expense_tracking/features/tags/data/tag.dart';
import 'package:daily_expense_tracking/features/transactions/application/tag_drafts.dart';
import 'package:daily_expense_tracking/features/transactions/application/transaction_query.dart';
import 'package:daily_expense_tracking/features/transactions/data/transaction.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// 验证关键金额、日期、序列化和草稿副作用边界。
void main() {
  // 金额精度及非法格式必须与 DTO 一致。
  test('金额使用整数分，正数录入与非负筛选区分', () {
    expect(yuanToCents('9999999999999.99'), 999999999999999);
    expect(yuanToCents('12.5'), 1250);
    expect(validateAmount('0'), isNotNull);
    expect(validateAmount('0.00', positive: false), isNull);
    // [value] 覆盖负数、指数、小数位、符号及末尾换行边界。
    for (final value in [
      '-1',
      '1e2',
      '01',
      '1.001',
      '¥1',
      '1,000',
      '1\n',
      '10000000000000',
    ]) {
      expect(validateAmount(value), isNotNull);
    }
    expect(money('-1.2'), '-¥1.20');
  });
  // 自然日期不能被 Dart 自动滚动成其他月份。
  test('自然日期闰日和时区边界', () {
    expect(naturalDate(parseNaturalDate('2024-02-29')), '2024-02-29');
    expect(() => parseNaturalDate('2026-02-29'), throwsFormatException);
    expect(() => parseNaturalDate('2026-13-01'), throwsFormatException);
    expect(naturalDate(DateTime(2026, 10, 14, 23, 59)), '2026-10-14');
  });
  // class-validator 使用 Unicode 码点，emoji 不能按 UTF-16 单元计数。
  test('中文、英文、emoji 文本长度与后端一致', () {
    expect(textLength('记账A😀'), 4);
    expect(validateText(List.filled(50, '😀').join(), 50), isNull);
    expect(validateText(List.filled(51, '😀').join(), 50), isNotNull);
  });
  // 月汇总严格禁止日明细字段，包括空字段。
  test('查询白名单、重复键数组与空字段省略', () {
    // 模拟同时带隐藏日明细草稿的月汇总条件。
    const query = TransactionQuery(
      period: '2026',
      monthly: true,
      categoryIds: [1, 2],
      tagIds: [3],
      title: 'x',
      remark: 'y',
    );
    expect(query.toQuery(), {
      'year': '2026',
      'categoryIds': [1, 2],
    });
    // 实际 Dio URI 序列化必须是重复键形式。
    final options = RequestOptions(
      path: '/transactions/daily',
      baseUrl: 'http://localhost:3000',
      listFormat: ListFormat.multi,
      queryParameters: const TransactionQuery(
        period: '2026-10',
        categoryIds: [1, 2],
        tagIds: [3, 4],
      ).toQuery(),
    );
    expect(options.uri.query, contains('categoryIds=1&categoryIds=2'));
    expect(options.uri.query, contains('tagIds=3&tagIds=4'));
    expect(options.uri.query, isNot(contains('%5B')));
  });
  // 三个统计板块只发送允许字段，收入强制一级。
  test('统计查询与比较周期边界', () {
    // 故意传入收入二级草稿，序列化仍须合法。
    const income = StatisticsQuery(
      panel: 'proportion',
      month: '2026-10',
      year: '2026',
      type: EntryType.income,
      level: 2,
      ascending: true,
    );
    expect(income.toQuery(), {
      'type': 'income',
      'month': '2026-10',
      'categoryLevel': 1,
    });
    expect(income.copyWith(panel: 'trend', yearly: true).toQuery(), {
      'type': 'income',
      'year': '2026',
    });
    expect(validPeriod('1000-01', false, '1000-02', '9999-11'), isFalse);
    expect(validPeriod('9999-11', false, '1000-02', '9999-11'), isTrue);
  });
  // 名称草稿没有假 ID，移除已有项同时移除改名。
  test('流水标签草稿保留原ID，取消和解绑不写全局标签', () {
    // 真实已有标签，改名不改变原模型。
    const original = Tag(id: 4, name: '早餐');
    // 本页未提交集合。
    final drafts = const TagDrafts()
        .add(const TagDraft(name: '早餐', original: original))
        .add(const TagDraft(name: '旅行'))
        .rename(0, '早饭');
    expect(drafts.toBody(), {
      'tagIds': [4],
      'tagNames': ['旅行'],
      'tagUpdates': [
        {'id': 4, 'name': '早饭'},
      ],
    });
    expect(original.name, '早餐');
    expect(drafts.remove(0).toBody(), {
      'tagIds': <int>[],
      'tagNames': ['旅行'],
    });
    expect(const TagDrafts().toBody(), {'tagIds': <int>[]});
  });
  // 写接口省略 data 合法；查询必要字段损坏不能填空模型。
  test('无data写入与nullable模型', () {
    expect(ApiClient.unwrap({'success': true}), isNull);
    expect(
      () => DailyResult.fromJson({'period': '2026-10'}),
      throwsA(isA<TypeError>()),
    );
    expect(
      TransactionCategory.fromJson({
        'primary': {
          'id': 1,
          'name': '工资',
          'iconKey': 'unknown',
          'backgroundColor': '#fff',
        },
        'secondary': null,
      }).secondary,
      isNull,
    );
  });
}
