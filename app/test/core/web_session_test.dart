import 'package:cookie_jar/cookie_jar.dart';
import 'package:daily_expense_tracking/core/config/app_config.dart';
import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/network/api_error.dart';
import 'package:daily_expense_tracking/core/network/http_adapter.dart'
    if (dart.library.js_interop) 'package:daily_expense_tracking/core/network/http_adapter_web.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fakes.dart';

/// 浏览器 Cookie 策略可在 VM 验证，真实传输适配器额外在 Chrome 检查。
void main() {
  // 网络替身和禁止访问的存储替身验证浏览器会话策略，不依赖浏览器测试器启动。
  group('Web 浏览器会话', () {
    test('默认同源请求并启用浏览器 Cookie', () {
      // 真实浏览器适配器应允许凭证请求。
      final adapter = createPlatformAdapter();
      addTearDown(adapter.close);
      expect((adapter as dynamic).withCredentials, isTrue);
      expect(AppConfig.apiUri.origin, Uri.base.origin);
    }, skip: !kIsWeb);

    test('无 Cookie 的启动刷新 401 进入登录页，不读取原生安全存储', () async {
      // 浏览器必须通过刷新请求判断 Cookie 是否存在。
      var refreshCount = 0;
      // 所有原生存储操作均会失败，确保 Web 完全依赖浏览器 Cookie。
      final client = ApiClient(
        Uri.parse('http://localhost:3000'),
        BrowserManagedStorage(),
        browserManagedCookies: true,
        adapterFactory: () => FakeAdapter((options) async {
          expect(options.path, '/auth/refresh');
          expect(options.headers, isNot(contains('Cookie')));
          refreshCount++;
          return failure(401);
        }),
      );
      addTearDown(client.dispose);
      await client.restore();
      expect(refreshCount, 1);
      expect(client.phase, SessionPhase.signedOut);
    });

    test('登录、刷新恢复和退出不触发原生 Cookie 管理器', () async {
      // 记录请求，确保恢复和退出均抵达服务端。
      final paths = <String>[];
      // 网络替身只提供业务响应，Cookie 的管理职责仍属于浏览器。
      Future<ResponseBody> handle(RequestOptions options) async {
        paths.add(options.path);
        expect(options.headers, isNot(contains('Cookie')));
        return options.path == '/auth/logout'
            ? success()
            : success({'accessToken': 'web-token'});
      }

      // 登录阶段不得实例化不支持 Web 的 CookieManager。
      final first = ApiClient(
        Uri.parse('http://localhost:3000'),
        BrowserManagedStorage(),
        browserManagedCookies: true,
        adapterFactory: () => FakeAdapter(handle),
      );
      await first.login('web-test@example.com', 'test-password');
      expect(first.phase, SessionPhase.signedIn);
      first.dispose();
      // 新客户端从服务端恢复会话，模拟浏览器刷新页面。
      final second = ApiClient(
        Uri.parse('http://localhost:3000'),
        BrowserManagedStorage(),
        browserManagedCookies: true,
        adapterFactory: () => FakeAdapter(handle),
      );
      addTearDown(second.dispose);
      await second.restore();
      expect(second.phase, SessionPhase.signedIn);
      await second.logout();
      expect(second.phase, SessionPhase.signedOut);
      expect(paths, ['/auth/login', '/auth/refresh', '/auth/logout']);
    });

    test('恢复时网络故障显示重试状态，不误判退出', () async {
      // 服务端暂时不可用时保留浏览器自行管理的会话。
      final client = ApiClient(
        Uri.parse('http://localhost:3000'),
        BrowserManagedStorage(),
        browserManagedCookies: true,
        adapterFactory: () => FakeAdapter((options) async => failure(503)),
      );
      addTearDown(client.dispose);
      await client.restore();
      expect(client.phase, SessionPhase.recoveryFailed);
      expect(client.recoveryError, isA<ApiError>());
    });
  });
}

/// Web 不得访问原生 Cookie 持久化，误调用时立即暴露问题。
class BrowserManagedStorage extends Storage {
  /// 浏览器不应初始化原生持久化存储。
  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async =>
      throw StateError('Web must not initialize native cookie storage');

  /// 浏览器不应从原生存储读取 HttpOnly Cookie。
  @override
  Future<String?> read(String key) async =>
      throw StateError('Web must not read native cookie storage');

  /// 浏览器不应把 Cookie 写入应用持久化存储。
  @override
  Future<void> write(String key, String value) async =>
      throw StateError('Web must not write native cookie storage');

  /// 浏览器只能通过服务端响应更新 HttpOnly Cookie。
  @override
  Future<void> delete(String key) async =>
      throw StateError('Web must not delete native cookie storage');

  /// 浏览器只能通过服务端退出接口清除 HttpOnly Cookie。
  @override
  Future<void> deleteAll(List<String> keys) async =>
      throw StateError('Web must not clear native cookie storage');
}
