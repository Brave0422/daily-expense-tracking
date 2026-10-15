import 'dart:convert';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/storage/secure_cookie_storage.dart';
import 'package:daily_expense_tracking/core/storage/safe_cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fakes.dart';

/// 验证正式 Storage 适配的环境隔离、损坏报告与过期策略。
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // 每个用例独立插件替身，只测试适配行为，不声称验证原生加密能力。
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  // 按主机环境命名空间清除，不能误删其他服务。
  test('安全存储按服务隔离并可清理损坏索引', () async {
    // 正式适配器的第一个环境。
    const first = SecureCookieStorage(FlutterSecureStorage(), 'first');
    // 另一服务的隔离数据。
    const second = SecureCookieStorage(FlutterSecureStorage(), 'second');
    await first.write('.index', jsonEncode(['localhost']));
    await second.write('.index', jsonEncode(['example.com']));
    await first.clearNamespace();
    expect(await first.read('.index'), isNull);
    expect(await second.read('.index'), contains('example.com'));
    await first.storage.write(key: 'first:.index', value: 'broken');
    await expectLater(first.read('.index'), throwsFormatException);
    await first.clearNamespace();
    expect(await first.read('.index'), isNull);
  });
  // 持久化 Cookie 结构和到期时间，不能 ignoreExpires。
  test('安全Cookie保留主机路径和过期约束', () async {
    // 正式平台安全适配器，底层仅在测试中替换。
    const storage = SecureCookieStorage(FlutterSecureStorage(), 'host');
    // 当前进程持久化 Jar。
    final jar = SafeCookieJar(storage);
    await jar.saveFromResponse(Uri.parse('https://example.com/auth/login'), [
      Cookie.fromSetCookieValue(
        'refresh_token=value; Path=/auth; HttpOnly; Secure; Max-Age=604800',
      ),
    ]);
    // 新进程 Jar 从插件加载完整属性。
    final restarted = SafeCookieJar(storage);
    expect(
      await restarted.loadForRequest(
        Uri.parse('https://example.com/transactions'),
      ),
      isEmpty,
    );
    expect(
      await restarted.loadForRequest(
        Uri.parse('http://example.com/auth/refresh'),
      ),
      isEmpty,
    );
    expect(
      (await restarted.loadForRequest(
        Uri.parse('https://example.com/auth/refresh'),
      )).single.httpOnly,
      true,
    );
    await jar.saveFromResponse(Uri.parse('https://example.com/auth/login'), [
      Cookie.fromSetCookieValue('refresh_token=expired; Path=/auth; Max-Age=0'),
    ]);
    // 无有效凭证的客户端禁止发起恢复请求。
    final expired = ApiClient(
      Uri.parse('https://example.com'),
      storage,
      adapterFactory: () => FakeAdapter(
        (options) async => throw StateError('expired cookie must not refresh'),
      ),
    );
    addTearDown(expired.dispose);
    await expired.restore();
    expect(expired.phase, SessionPhase.signedOut);
  });
}
