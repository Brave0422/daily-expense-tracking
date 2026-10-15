import 'package:dio/dio.dart';

import 'api_client.dart';

/// Service 只负责既有端点的 HTTP 传输，不持有页面草稿或 BuildContext。
class ApiService {
  /// [client] 是统一的安全会话客户端。
  const ApiService(this.client);

  /// 所有模块共用的传输和认证协调器。
  final ApiClient client;

  /// 查询 [path]；[query] 只包含端点支持的字段；[cancel] 取消旧查询。
  Future<Object?> get(
    String path,
    Map<String, dynamic> query,
    CancelToken cancel,
  ) => client.request(path, query: query, cancelToken: cancel);

  /// 写入 [path]；[body] 为可复用 JSON；[method] 为写入方式；
  /// [protected] 表示是否需要会话。只对认证守卫拒绝执行一次重放。
  Future<Object?> write(
    String path,
    Map<String, dynamic>? body, {
    String method = 'POST',
    bool protected = true,
  }) => client.request(path, method: method, body: body, protected: protected);
}
