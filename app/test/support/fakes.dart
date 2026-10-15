import 'dart:convert';
import 'dart:typed_data';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';

/// 仅测试使用的内存 Cookie 存储，正式流程仍为安全插件。
class MemoryStorage extends Storage {
  /// 已保存的 Cookie 序列化数据，用于重启和轮换断言。
  final Map<String, String> values = {};

  /// 测试安全存储写失败。
  bool failWrites = false;

  /// [persistSession]、[ignoreExpires] 由 Jar 管理，替身无需初始化目录。
  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}

  /// 返回 [key] 的测试 Cookie。
  @override
  Future<String?> read(String key) async => values[key];

  /// 写入 [key] 的 [value]，可模拟失败。
  @override
  Future<void> write(String key, String value) async {
    if (failWrites) {
      throw StateError('test storage failure');
    }
    values[key] = value;
  }

  /// 删除 [key]。
  @override
  Future<void> delete(String key) async => values.remove(key);

  /// 删除 [keys] 对应数据，模拟本机清理。
  @override
  Future<void> deleteAll(List<String> keys) async {
    // [key] 为待删除的 Jar 索引或主机键。
    for (final key in keys) {
      values.remove(key);
    }
  }
}

/// 可模拟延迟、401 和失败的真实 Dio 传输替身，不绕过拦截器。
class FakeAdapter implements HttpClientAdapter {
  /// [handle] 按请求返回响应，支持异步竞态控制。
  FakeAdapter(this.handle);

  /// 每个请求的模拟服务端行为。
  final Future<ResponseBody> Function(RequestOptions) handle;

  /// 将 [options] 交给行为替身；[requestStream]、[cancelFuture] 由 Dio 负责取消逻辑。
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => handle(options);

  /// [force] 为客户端释放要求，替身没有 socket 资源。
  @override
  void close({bool force = false}) {}
}

/// 构建成功响应。[data] 可省略，验证无 data 写入；[cookie] 模拟 Set-Cookie。
ResponseBody success([Object? data, String? cookie]) => ResponseBody.fromString(
  jsonEncode({
    'success': true,
    'code': 200,
    'msg': 'ok',
    'timestamp': '2026-10-14T00:00:00Z',
    'data': ?data,
  }),
  200,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
    if (cookie != null) 'set-cookie': [cookie],
  },
);

/// 构建 HTTP [status] 失败，保留实际 NestJS 错误形状。
ResponseBody failure(int status) => ResponseBody.fromString(
  jsonEncode({'statusCode': status, 'message': 'test failure'}),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

/// [value] 表示轮换 Cookie 的测试值，保留路径和有效期属性。
String refreshCookie(String value) =>
    'refresh_token=$value; Path=/auth; HttpOnly; Max-Age=604800; SameSite=Lax';
