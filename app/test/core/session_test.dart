import 'dart:async';

import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/network/api_error.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fakes.dart';

/// 在完整 Dio 拦截器与 Cookie Jar 上验证并发刷新和退出竞态。
void main() {
  // 首次启动没有 Cookie，不发送恢复请求。
  test('无Cookie启动直接进入未登录', () async {
    // 即使网络不可用也不应执行任何请求。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      MemoryStorage(),
      adapterFactory: () => FakeAdapter(
        (options) async => throw StateError('unexpected request'),
      ),
    );
    addTearDown(client.dispose);
    await client.restore();
    expect(client.phase, SessionPhase.signedOut);
  });

  // 多个同时失败请求与迟到请求都只轮换一次。
  test('并发401共享刷新，迟到旧Token不重复轮换', () async {
    // 持久化 Cookie 内容用于确认响应已落盘。
    final storage = MemoryStorage();
    // 单次刷新计数。
    var refreshCount = 0;
    // 保持第二个旧Token响应迟到。
    final lateResponse = Completer<void>();
    // 第一批请求的服务行为，经过真实拦截器。
    Future<ResponseBody> handle(RequestOptions options) async {
      if (options.path == '/auth/login') {
        return success({'accessToken': 'old'}, refreshCookie('old-cookie'));
      }
      if (options.path == '/auth/refresh') {
        refreshCount++;
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return success({'accessToken': 'new'}, refreshCookie('new-cookie'));
      }
      if (options.headers['Authorization'] == 'Bearer old') {
        if (options.path == '/late') {
          await lateResponse.future;
        }
        return failure(401);
      }
      return success({'ok': true});
    }

    // 本次完整网络客户端。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(handle),
    );
    addTearDown(client.dispose);
    await client.login('TEST@example.com', '123456');
    // 旧请求先进入网络，最后才返回 401。
    final late = client.request('/late');
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await Future.wait([client.request('/first'), client.request('/second')]);
    lateResponse.complete();
    await late;
    expect(refreshCount, 1);
    expect(storage.values.values.join(), contains('new-cookie'));
    expect(
      await client.jar.loadForRequest(
        Uri.parse('http://localhost:3000/transactions'),
      ),
      isEmpty,
    );
    expect(client.email, 'test@example.com');
  });

  // Cookie 轮换在重启后可用，临时故障不能删除它。
  test('重启恢复轮换Cookie，503保留可恢复凭证', () async {
    // 两个客户端共享同一安全存储替身，模拟进程重启。
    final storage = MemoryStorage();
    // 决定刷新是否暂时故障。
    var unavailable = false;
    // 服务端根据登录和刷新返回不同 Cookie。
    Future<ResponseBody> handle(RequestOptions options) async =>
        options.path == '/auth/login'
        ? success({'accessToken': 'old'}, refreshCookie('old-cookie'))
        : unavailable
        ? failure(503)
        : success({'accessToken': 'new'}, refreshCookie('new-cookie'));
    // 第一进程登录落盘。
    final first = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(handle),
    );
    await first.login('test@example.com', '123456');
    first.dispose();
    // 第二进程没有内存 Access Token，用 Cookie 恢复。
    final second = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(handle),
    );
    addTearDown(second.dispose);
    await second.restore();
    expect(second.phase, SessionPhase.signedIn);
    expect(second.email, isNull);
    expect(storage.values.values.join(), contains('new-cookie'));
    unavailable = true;
    await second.restore();
    expect(second.phase, SessionPhase.recoveryFailed);
    expect(storage.values.values.join(), contains('new-cookie'));
  });

  // 单次重放仍为401时必须结束，不能循环刷新。
  test('重放最多一次，明确401清除会话', () async {
    // 已保存 Cookie 用于退出后的断言。
    final storage = MemoryStorage();
    // 只有一轮 refresh 允许发生。
    var refreshCount = 0;
    // 所有业务请求拒绝，即使新 Access Token 也不能继续刷新。
    Future<ResponseBody> handle(RequestOptions options) async {
      if (options.path == '/auth/login') {
        return success({'accessToken': 'old'}, refreshCookie('old-cookie'));
      }
      if (options.path == '/auth/refresh') {
        refreshCount++;
        return success({'accessToken': 'new'}, refreshCookie('new-cookie'));
      }
      return failure(401);
    }

    // 本次认证客户端。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(handle),
    );
    addTearDown(client.dispose);
    await client.login('test@example.com', '123456');
    await expectLater(client.request('/denied'), throwsA(isA<ApiError>()));
    expect(refreshCount, 1);
    expect(client.phase, SessionPhase.signedOut);
    expect(storage.values.values.join(), isNot(contains('new-cookie')));
  });

  // 退出在刷新尚未返回时也不能被迟到Cookie复活。
  test('退出阻止迟到刷新恢复身份和Cookie', () async {
    // Cookie 存储替身。
    final storage = MemoryStorage();
    // 刷新请求已进入网络的信号。
    final started = Completer<void>();
    // 退出后才释放的刷新响应。
    final finish = Completer<void>();
    // 可控服务端行为。
    Future<ResponseBody> handle(RequestOptions options) async {
      if (options.path == '/auth/login') {
        return success({'accessToken': 'old'}, refreshCookie('old-cookie'));
      }
      if (options.path == '/auth/refresh') {
        started.complete();
        await finish.future;
        return success({'accessToken': 'late'}, refreshCookie('late-cookie'));
      }
      return success();
    }

    // 本次客户端，取消仍由 Dio 处理。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(handle),
    );
    addTearDown(client.dispose);
    await client.login('test@example.com', '123456');
    // 先订阅失败，避免取消刷新造成未处理异步异常。
    final pending = expectLater(client.refresh(), throwsA(isA<DioException>()));
    await started.future;
    await client.logout();
    finish.complete();
    await pending;
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(client.phase, SessionPhase.signedOut);
    expect(storage.values.values.join(), isNot(contains('late-cookie')));
  });

  // 旧登录取消后不能清理已建立的新账号会话。
  test('账号切换隔离迟到登录及Cookie', () async {
    // 当前安全存储替身，验证最终只含新账号 Cookie。
    final storage = MemoryStorage();
    // 旧登录进入网络的信号。
    final started = Completer<void>();
    // 旧登录在新账号登录后才返回。
    final release = Completer<void>();
    // 按邮箱模拟两个独立身份。
    Future<ResponseBody> handle(RequestOptions options) async {
      // JSON 请求中的登录邮箱，仅用于路由测试身份，不输出密码。
      final email = (options.data as Map<String, dynamic>)['email'];
      if (email == 'old@example.com') {
        started.complete();
        await release.future;
        return success({
          'accessToken': 'old-access',
        }, refreshCookie('old-cookie'));
      }
      return success({
        'accessToken': 'new-access',
      }, refreshCookie('new-cookie'));
    }

    // 会话切换与拦截器均使用正式实现。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(handle),
    );
    addTearDown(client.dispose);
    // 提前观察旧登录取消失败，避免产生未处理异步错误。
    final oldLogin = expectLater(
      client.login('old@example.com', '123456'),
      throwsA(isA<ApiError>()),
    );
    await started.future;
    await client.login('new@example.com', '123456');
    release.complete();
    await oldLogin;
    expect(client.phase, SessionPhase.signedIn);
    expect(client.email, 'new@example.com');
    expect(storage.values.values.join(), contains('new-cookie'));
    expect(storage.values.values.join(), isNot(contains('old-cookie')));
  });

  // 持久化失败不能发布已登录状态。
  test('Cookie落盘失败不能建立可恢复会话', () async {
    // 只在实际Cookie写入时失败。
    final storage = MemoryStorage()..failWrites = true;
    // 服务端返回有效认证结果，但安全存储不可用。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      storage,
      adapterFactory: () => FakeAdapter(
        (options) async =>
            success({'accessToken': 'token'}, refreshCookie('cookie')),
      ),
    );
    addTearDown(client.dispose);
    await expectLater(
      client.login('test@example.com', '123456'),
      throwsA(isA<ApiError>()),
    );
    expect(client.phase, isNot(SessionPhase.signedIn));
  });
}
