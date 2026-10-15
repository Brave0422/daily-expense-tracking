import 'package:dio/dio.dart';

import '../../features/categories/data/category.dart';
import '../../features/statistics/application/statistics_query.dart';
import '../../features/statistics/data/statistics.dart';
import '../../features/tags/data/tag.dart';
import '../../features/transactions/application/transaction_query.dart';
import '../../features/transactions/data/transaction.dart';
import 'api_error.dart';
import 'api_service.dart';

/// 组合各业务的数据访问；模型解析只在数据层进行，页面不传播 dynamic。
class BookRepository {
  /// [service] 为端点传输；[changed] 在成功写入后让关联查询失效。
  const BookRepository(this.service, this.changed);

  /// 统一 Service，不依赖 BuildContext。
  final ApiService service;

  /// 成功写入后通知业务数据变化，不把重查失败当作保存失败。
  final void Function() changed;

  /// 校验 [data] 为对象，损坏响应不能被替换为空模型。
  static Map<String, dynamic> object(Object? data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiError('服务数据格式不正确');
    }
    return data;
  }

  /// 解析 [data] 的对象列表，显式拒绝缺失或错误类型。
  static List<Map<String, dynamic>> objects(Object? data) {
    if (data is! List) {
      throw const ApiError('服务列表格式不正确');
    }
    return data.map(object).toList();
  }

  /// 查询 [type] 的分类树；[archived] 为历史选项；[cancel] 防止旧响应回写。
  Future<List<Category>> categories(
    EntryType type,
    bool archived,
    CancelToken cancel,
  ) async => objects(
    await service.get('/categories/getUserCategories', {
      'type': type.name,
      if (archived) 'includeArchived': true,
    }, cancel),
  ).map(Category.fromJson).toList();

  /// 查询图库。[cancel] 在页面退出时取消。
  Future<List<CategoryIconOption>> icons(CancelToken cancel) async =>
      objects(await service.get('/categories/getAllIcons', {}, cancel))
          .map(CategoryIconOption.fromJson)
          .toList();

  /// 查询标签。[key] 非空时使用服务器搜索；[archived] 用于历史筛选；[cancel] 取消旧查询。
  Future<List<Tag>> tags(String key, bool archived, CancelToken cancel) async =>
      objects(
        await service.get(key.trim().isEmpty ? '/tags' : '/tags/search', {
          if (key.trim().isNotEmpty) 'key': key.trim(),
          if (key.trim().isEmpty && archived) 'includeArchived': true,
        }, cancel),
      ).map(Tag.fromJson).toList();

  /// 只读检查 [name] 的同名有效标签；[cancel] 为表单生命周期取消句柄。
  Future<Tag?> checkTag(String name, CancelToken cancel) async {
    // 不创建标签，流水取消不会留下数据库副作用。
    final data = await service.get('/tags/check-name', {
      'name': name.trim(),
    }, cancel);
    return data == null ? null : Tag.fromJson(object(data));
  }

  /// 查询 [query] 的日明细或月汇总；[cancel] 取消过时条件。
  Future<Object> transactions(
    TransactionQuery query,
    CancelToken cancel,
  ) async {
    // 每种模式使用自己的白名单，月汇总不会发送隐藏的日明细字段。
    final data = object(
      await service.get(
        query.monthly ? '/transactions/monthly-summary' : '/transactions/daily',
        query.toQuery(),
        cancel,
      ),
    );
    if (object(data['totals'])['balance'] is! String) {
      throw const ApiError('周期结余数据不完整，请重试查询');
    }
    return query.monthly
        ? MonthlyResult.fromJson(data)
        : DailyResult.fromJson(data);
  }

  /// 查询 [query] 的统计板块；[cancel] 取消旧周期结果。
  Future<StatisticsResult> statistics(
    StatisticsQuery query,
    CancelToken cancel,
  ) async {
    // 先校验端点必需数组，避免损坏响应被误展示为零金额。
    final data = object(await service.get(query.path, query.toQuery(), cancel));
    if (data[query.panel == 'trend' ? 'series' : 'items'] is! List) {
      throw const ApiError('统计结果不完整');
    }
    if (query.panel == 'trend' &&
        (![
              'increase',
              'decrease',
              'unchanged',
              'new',
            ].contains(data['changeStatus']) ||
            data['previousPeriod'] is! String ||
            data['previousTotalAmount'] is! String)) {
      throw const ApiError('趋势比较结果不完整');
    }
    return StatisticsResult.fromJson(data);
  }

  /// 写入 [path] 的 [body]；[method] 按契约选择。成功仅标记失效，不等待列表重查。
  Future<void> save(
    String path,
    Map<String, dynamic>? body, {
    String method = 'POST',
  }) async {
    await service.write(path, body, method: method);
    changed();
  }
}
