import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../features/categories/data/category.dart';
import '../features/statistics/application/statistics_query.dart';
import '../features/statistics/data/statistics.dart';
import '../features/tags/data/tag.dart';
import '../features/transactions/application/transaction_query.dart';
import 'config/app_config.dart';
import 'network/api_client.dart';
import 'network/api_error.dart';
import 'network/api_service.dart';
import 'network/book_repository.dart';
import 'storage/secure_cookie_storage.dart';

/// 会话不可变快照，只公开路由和账户页面需要的非敏感字段。
typedef SessionView = ({
  SessionPhase phase,
  int generation,
  String? email,
  ApiError? error,
});

/// 平台安全客户端生命周期由 Provider 管理，可在测试中覆盖。
final apiClientProvider = Provider<ApiClient>((ref) {
  // 服务地址按环境命名空间隔离，Access Token 不写入插件。
  final uri = AppConfig.apiUri;
  // 原生端当前服务专用 Cookie 存储；Web 不读写该存储，交由浏览器管理凭证。
  final storage = SecureCookieStorage(
    const FlutterSecureStorage(),
    'det:${Uri.encodeComponent(uri.toString())}',
  );
  // Provider 持有的单一客户端实例。
  final client = ApiClient(uri, storage);
  ref.onDispose(client.dispose);
  return client;
});

/// 响应 ApiClient 的认证变化，提供 Riverpod 会话状态。
final sessionProvider = NotifierProvider<SessionController, SessionView>(
  SessionController.new,
);

/// 会话 ViewModel，协调初始化并释放监听，不复制 Token 刷新逻辑。
class SessionController extends Notifier<SessionView> {
  /// 读取当前客户端快照，不暴露 Token。
  SessionView _snapshot() {
    // 当前 Provider 持有的安全客户端。
    final client = ref.read(apiClientProvider);
    return (
      phase: client.phase,
      generation: client.generation,
      email: client.email,
      error: client.recoveryError,
    );
  }

  /// 注册会话监听，并在 Provider 完成构造后进行一次恢复。
  @override
  SessionView build() {
    // 同一 ProviderScope 内的网络客户端。
    final client = ref.watch(apiClientProvider);
    client.addListener(_update);
    ref.onDispose(() => client.removeListener(_update));
    // 安全存储读取前保持启动页，避免闪现业务页。
    unawaited(Future<void>.microtask(client.restore));
    return _snapshot();
  }

  /// 在客户端通知时同步不可变快照，用身份序号重建账号业务状态。
  void _update() => state = _snapshot();
}

/// 业务写入失效版本，各类查询订阅此版本后重查。
final dataRevisionProvider = NotifierProvider<DataRevision, int>(
  DataRevision.new,
);

/// 统一跨模块查询失效，写入成功与刷新失败保持分离。
class DataRevision extends Notifier<int> {
  /// 初始没有业务写入。
  @override
  int build() => 0;

  /// 让当前订阅查询失效，后台板块下一次进入读取新版本。
  void changed() => state++;
}

/// 数据层组合依赖，View 通过 Repository 访问服务。
final repositoryProvider = Provider<BookRepository>(
  (ref) => BookRepository(
    ApiService(ref.watch(apiClientProvider)),
    ref.read(dataRevisionProvider.notifier).changed,
  ),
);

/// 每个查询持有自己的取消句柄；[ref] 销毁或条件改变时取消。
CancelToken queryToken(Ref ref) {
  ref.watch(sessionProvider.select((session) => session.generation));
  ref.watch(dataRevisionProvider);
  // 每次 Provider 构造都产生独立取消标识。
  final cancel = CancelToken();
  ref.onDispose(() => cancel.cancel('查询条件或页面已变化'));
  return cancel;
}

/// 分类查询键按方向和历史选项隔离。
typedef CategoryKey = ({EntryType type, bool archived});

/// 分类树查询。[ref] 管理取消；[key] 指定方向和归档选项。
final categoriesProvider = FutureProvider.autoDispose
    .family<List<Category>, CategoryKey>(
      (ref, key) => ref
          .read(repositoryProvider)
          .categories(key.type, key.archived, queryToken(ref)),
    );

/// 图库查询。[ref] 管理取消和会话隔离。
final iconsProvider = FutureProvider.autoDispose<List<CategoryIconOption>>(
  (ref) => ref.read(repositoryProvider).icons(queryToken(ref)),
);

/// 标签查询键，非空关键词请求后端搜索。
typedef TagKey = ({String key, bool archived});

/// 标签查询。[ref] 管理取消；[key] 选择搜索和历史模式。
final tagsProvider = FutureProvider.autoDispose.family<List<Tag>, TagKey>(
  (ref, key) =>
      ref.read(repositoryProvider).tags(key.key, key.archived, queryToken(ref)),
);

/// 流水查询。[ref] 防止旧响应；[query] 为不可变条件标识。
final transactionsProvider = FutureProvider.autoDispose
    .family<Object, TransactionQuery>(
      (ref, query) =>
          ref.read(repositoryProvider).transactions(query, queryToken(ref)),
    );

/// 只被当前可见统计板块订阅。[ref] 管理请求；[query] 为独立条件。
final statisticsProvider = FutureProvider.autoDispose
    .family<StatisticsResult, StatisticsQuery>(
      (ref, query) =>
          ref.read(repositoryProvider).statistics(query, queryToken(ref)),
    );
