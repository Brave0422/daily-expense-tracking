import 'dart:async';
import 'dart:convert';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 串行执行 Cookie 保存和会话清理，防止退出被迟到写入覆盖。
class AsyncGate {
  /// 当前排队尾部；失败不阻塞后续清理。
  Future<void> _tail = Future<void>.value();

  /// 按顺序执行 [action]，返回其真实结果或失败。
  Future<T> run<T>(Future<T> Function() action) {
    // 本次任务等待前一项完成，调用方仍收到自身错误。
    final result = _tail.then((_) => action());
    // 忽略参数为前一项错误，仅为允许下一项执行，并非吞掉调用方错误。
    _tail = result.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return result;
  }
}

/// PersistCookieJar 的 Keychain / Android 加密存储适配。
class SecureCookieStorage extends Storage {
  /// 创建存储。[storage] 为安全插件；[namespace] 按完整 API 地址隔离环境。
  const SecureCookieStorage(this.storage, this.namespace);

  /// 平台加密存储，不使用普通文件保存 Refresh Cookie。
  final FlutterSecureStorage storage;

  /// 环境及主机前缀，避免服务地址切换复用凭证。
  final String namespace;

  /// 初始化存储。[persistSession] 和 [ignoreExpires] 由 Cookie Jar 管理；无需目录。
  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}

  /// 读取 [key] 对应的完整 Cookie 序列化数据；损坏由 Jar 解析时报错。
  @override
  Future<String?> read(String key) async {
    // 在 Jar 自身吞掉损坏索引之前报告错误，保留凭证供用户选择重试或清理。
    final value = await storage.read(key: '$namespace:$key');
    if (value != null && value.isNotEmpty) {
      // 持久化格式由 Cookie Jar 管理，但需要提前检查索引和每个 Cookie 的结构。
      final decoded = jsonDecode(value);
      if (key == '.index') {
        if (decoded is! List || decoded.any((item) => item is! String)) {
          throw const FormatException('Cookie 索引损坏');
        }
      } else {
        _validateCookies(decoded, key == '.domains' ? 3 : 2);
      }
    }
    return value;
  }

  /// 检查 [value] 的 Cookie 存储树；[depth] 为主机路径或共享域的嵌套层数。
  void _validateCookies(Object? value, int depth) {
    if (depth == 0) {
      if (value is! String) {
        throw const FormatException('Cookie 数据损坏');
      }
      SerializableCookie.fromJson(value);
      return;
    }
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Cookie 结构损坏');
    }
    // 每个 [child] 表示下一层路径或完整的 Cookie 序列化值。
    for (final child in value.values) {
      _validateCookies(child, depth - 1);
    }
  }

  /// 写入 [key] 的 [value]；等待完成后才允许建立恢复会话。
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: '$namespace:$key', value: value);

  /// 删除 [key]；失败向调用方报告，不能声称已安全退出。
  @override
  Future<void> delete(String key) => storage.delete(key: '$namespace:$key');

  /// 删除当前 Jar 的 [keys]，不删除其他服务的安全存储。
  @override
  Future<void> deleteAll(List<String> keys) async {
    // 每个 Cookie 存储键逐一删除，保留插件中其他命名空间。
    for (final key in keys) {
      await delete(key);
    }
  }

  /// 删除此服务所有 Cookie 键，支持损坏索引后的重新登录，不影响其他安全数据。
  Future<void> clearNamespace() async {
    // 插件中当前的加密键集合，仅匹配本环境前缀。
    final values = await storage.readAll();
    // 逐一清理匹配键，任何删除失败都向调用方报告。
    for (final key in values.keys.toList()) {
      if (key.startsWith('$namespace:')) {
        await storage.delete(key: key);
      }
    }
  }
}
