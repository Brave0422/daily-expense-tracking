import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';

import '../storage/secure_cookie_storage.dart';
import '../storage/safe_cookie_jar.dart';
import 'api_error.dart';
import 'http_adapter.dart' if (dart.library.js_interop) 'http_adapter_web.dart';

/// 会话恢复及访问控制所需的四种状态。
enum SessionPhase {
  /// 正在安全装载凭证，不开放业务路由。
  restoring,

  /// 没有可恢复凭证或认证已明确失效。
  signedOut,

  /// Access Token 已在内存，Cookie 已安全落盘。
  signedIn,

  /// 临时网络或安全存储故障，允许重试。
  recoveryFailed,
}

/// 在会话串行锁中保存 Cookie，拒绝迟到的旧账号响应。
class SessionCookieManager extends CookieManager {
  /// [cookieJar] 保留 Cookie 属性；[gate] 协调清理；[generation] 提供当前会话序号。
  SessionCookieManager(super.cookieJar, this.gate, this.generation);

  /// Cookie 持久化与清理共用的锁。
  final AsyncGate gate;

  /// 读取当前身份序号，不持有旧身份快照。
  final int Function() generation;

  /// 保存 [response] 中的 Cookie；锁内再次校验身份，避免等待期间已退出。
  @override
  Future<void> saveCookies(Response<dynamic> response) => gate.run(() async {
    if (response.requestOptions.extra['generation'] == generation()) {
      await super.saveCookies(response);
    }
  });
}

/// 通用 HTTP、双 Token 协调与安全会话边界；业务页面通过 Repository 使用。
class ApiClient extends ChangeNotifier {
  /// [baseUri] 为直连服务地址；[storage] 为可测试的 Cookie Storage。
  /// 原生端两个 Dio 共用 Jar；Web 共用浏览器 Cookie，刷新客户端没有递归拦截器。
  /// [adapterFactory] 仅为网络边界测试注入传输替身，正式运行使用平台适配器。
  /// [browserManagedCookies] 默认取当前平台，测试可注入浏览器 Cookie 策略。
  ApiClient(
    this.baseUri,
    this.storage, {
    this.adapterFactory,
    this.browserManagedCookies = kIsWeb,
  }) {
    _configure();
  }

  /// 服务环境及可选网关前缀。
  final Uri baseUri;

  /// 原生端 Refresh Cookie 安全存储适配；Web 的 HttpOnly Cookie 由浏览器管理。
  final Storage storage;

  /// 可选的测试传输工厂，每次身份切换也生成独立适配器。
  final HttpClientAdapter Function()? adapterFactory;

  /// 浏览器管理 Cookie 时禁止应用层读取、持久化或手动设置 Cookie。
  final bool browserManagedCookies;

  /// 顺序化 Cookie 写入和身份清理。
  final AsyncGate _gate = AsyncGate();

  /// 普通请求客户端。
  late Dio dio;

  /// 不递归刷新认证的专用客户端。
  late Dio refreshDio;

  /// 原生端保留到期、主机、路径等属性的安全 Cookie Jar；Web 不创建此实例。
  late PersistCookieJar jar;

  /// Access Token 仅存内存。
  String? _accessToken;

  /// 当前身份变更序号，旧请求不能跨越此边界。
  int generation = 0;

  /// 会话当前恢复 / 登录状态。
  SessionPhase phase = SessionPhase.restoring;

  /// 本次登录输入的邮箱；启动恢复后没有资料接口，因此为空。
  String? email;

  /// 恢复或清理失败的持续错误信息。
  ApiError? recoveryError;

  /// 同一身份中的共享刷新任务。
  Future<void>? _refreshTask;

  /// 一轮清理共享一个任务，请求取消后也等待清理完成再交给调用方。
  Future<void>? _cleanupTask;

  /// 所有仍在执行的请求；身份切换时统一取消。
  final Set<CancelToken> _requests = {};

  /// 清理失败时不能重新开放旧内存身份。
  bool _needsCleanup = false;

  /// 创建新的 Jar 和客户端，避免清理后复用旧的内存 Cookie。
  void _configure() {
    if (!browserManagedCookies) {
      jar = SafeCookieJar(storage);
    }
    dio = _newDio();
    refreshDio = _newDio();
    dio.interceptors.add(InterceptorsWrapper(onError: _onError));
  }

  /// 创建 HTTP 客户端并集中配置超时、重复键查询和会话保护。
  Dio _newDio() {
    // 显式 multi 输出 categoryIds=1&categoryIds=2，不带方括号。
    final client = Dio(
      BaseOptions(
        baseUrl: baseUri.toString(),
        connectTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        listFormat: ListFormat.multi,
        contentType: Headers.jsonContentType,
      ),
    );
    client.httpClientAdapter =
        adapterFactory?.call() ?? createPlatformAdapter();
    client.interceptors.add(
      InterceptorsWrapper(
        // [options] 为请求配置；[handler] 继续或拒绝请求。重放保留原身份序号。
        onRequest: (options, handler) {
          options.extra.putIfAbsent('generation', () => generation);
          if (options.extra['generation'] != generation ||
              (options.extra['protected'] == true &&
                  phase != SessionPhase.signedIn)) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.cancel,
              ),
            );
            return;
          }
          if (options.extra['protected'] == true && _accessToken != null) {
            options.headers['Authorization'] = 'Bearer $_accessToken';
          }
          handler.next(options);
        },
        // [response] 为网络结果；[handler] 防止旧账号响应进入模型解析。
        onResponse: (response, handler) {
          if (response.requestOptions.extra['generation'] != generation) {
            handler.reject(
              DioException(
                requestOptions: response.requestOptions,
                type: DioExceptionType.cancel,
              ),
            );
            return;
          }
          handler.next(response);
        },
      ),
    );
    // 原生端等待安全落盘；Web 禁止 CookieManager，由浏览器处理 Set-Cookie。
    if (!browserManagedCookies) {
      client.interceptors.add(
        SessionCookieManager(jar, _gate, () => generation),
      );
    }
    return client;
  }

  /// 处理 [error] 的受保护 401；[handler] 返回单次重放结果或真实失败。
  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    // 原请求信息可安全复用，首版所有请求体均为 JSON。
    final request = error.requestOptions;
    if (request.extra['generation'] != generation ||
        phase != SessionPhase.signedIn ||
        request.extra['protected'] != true ||
        error.response?.statusCode != 401) {
      handler.next(error);
      return;
    }
    try {
      if (request.extra['replayed'] == true) {
        await clearSession();
        handler.next(error);
        return;
      }
      // 迟到旧 Token 请求直接使用当前 Token，不再轮换 Cookie。
      if (request.headers['Authorization'] == 'Bearer $_accessToken') {
        await refresh();
      }
      if (request.extra['generation'] != generation || _accessToken == null) {
        handler.next(error);
        return;
      }
      request.extra['replayed'] = true;
      request.headers.remove('Cookie');
      request.headers.remove('cookie');
      request.headers['Authorization'] = 'Bearer $_accessToken';
      handler.resolve(await dio.fetch<dynamic>(request));
    } on DioException catch (failure) {
      // [failure] 为刷新或重放失败，保留 HTTP 状态。
      handler.next(failure);
    } catch (failure) {
      // [failure] 为存储失败或已转换的用户错误。
      handler.reject(DioException(requestOptions: request, error: failure));
    }
  }

  /// 请求并解包真实成功响应。[path] 不包含 Web 代理前缀；[method] 为 HTTP 方法；
  /// [query] 为白名单查询；[body] 为 JSON；[protected] 控制 Bearer / 刷新；
  /// [cancelToken] 允许读请求取消；无 data 的写入返回 null。
  Future<Object?> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? query,
    Object? body,
    bool protected = true,
    CancelToken? cancelToken,
  }) async {
    // 外部取消句柄或本次独立句柄，退出时都可被收集取消。
    final token = cancelToken ?? CancelToken();
    _requests.add(token);
    try {
      // 使用相对路径保证可选部署前缀不被绝对路径丢弃。
      final response = await dio.request<dynamic>(
        path,
        queryParameters: query,
        data: body,
        cancelToken: token,
        options: Options(method: method, extra: {'protected': protected}),
      );
      return unwrap(response.data);
    } catch (error) {
      // [error] 只转换文案，不记录敏感请求内容，不自动重试网络写入。
      if (_cleanupTask != null) {
        try {
          await _cleanupTask;
        } catch (_) {
          // 本机清理错误由 recoveryFailed 持续呈现，原请求保留真实失败。
        }
      }
      throw ApiError.from(error, writing: method != 'GET');
    } finally {
      _requests.remove(token);
    }
  }

  /// 校验并解包 [body]；缺失写入 data 合法，查询调用方另行校验模型结构。
  static Object? unwrap(Object? body) {
    if (body is! Map<String, dynamic> || body['success'] != true) {
      throw const ApiError('服务响应格式不正确，请重试');
    }
    return body['data'];
  }

  /// 安全装载 Cookie 后恢复；暂时网络故障保留凭证并呈现重试。
  Future<void> restore() async {
    phase = SessionPhase.restoring;
    recoveryError = null;
    notifyListeners();
    try {
      if (_needsCleanup) {
        await clearSession();
        return;
      }
      if (browserManagedCookies) {
        // JavaScript 无法读取 HttpOnly Cookie，恢复状态由服务端刷新接口确认。
        await refresh();
      } else {
        // 原生端可先检查持久化 Cookie，无凭证时无需发送刷新请求。
        final cookies = await jar.loadForRequest(
          Uri.parse('${baseUri.toString()}/auth/refresh'),
        );
        if (!cookies.any((cookie) => cookie.name == 'refresh_token')) {
          phase = SessionPhase.signedOut;
        } else {
          await refresh();
        }
      }
    } catch (error) {
      // [error] 为装载或恢复失败；明确失效已由 refresh 统一清理。
      if (phase != SessionPhase.signedOut) {
        phase = SessionPhase.recoveryFailed;
        recoveryError = ApiError.from(error);
      }
    }
    notifyListeners();
  }

  /// 共享刷新任务，异步返回时仍校验身份；明确 401 才清除长期凭证。
  Future<void> refresh() {
    if (_refreshTask != null) {
      return _refreshTask!;
    }
    // 旧任务结束不能清除新账号的刷新任务，使用任务引用校验。
    late final Future<void> task;
    task = _performRefresh().whenComplete(() {
      if (identical(_refreshTask, task)) {
        _refreshTask = null;
      }
    });
    _refreshTask = task;
    return task;
  }

  /// 执行一次无递归的 Token 轮换，Cookie 持久化成功后才发布新 Token。
  Future<void> _performRefresh() async {
    // 捕获本次刷新身份，退出后不能复活。
    final identity = generation;
    // 将刷新也纳入退出取消集合。
    final token = CancelToken();
    _requests.add(token);
    try {
      // 独立客户端不会触发自动刷新拦截器。
      final response = await refreshDio.post<dynamic>(
        '/auth/refresh',
        cancelToken: token,
        options: Options(extra: {'generation': identity}),
      );
      if (identity != generation) {
        throw const ApiError('会话已变更');
      }
      _acceptToken(unwrap(response.data));
      phase = SessionPhase.signedIn;
      notifyListeners();
    } on DioException catch (error) {
      // [error] 为刷新失败；临时断网或 5xx 不删除 Cookie。
      if (identity == generation && error.response?.statusCode == 401) {
        await clearSession();
      }
      rethrow;
    } finally {
      _requests.remove(token);
    }
  }

  /// 解析 [data] 的非空 Access Token；拒绝损坏响应而非创建空模型。
  void _acceptToken(Object? data) {
    if (data is! Map<String, dynamic> ||
        data['accessToken'] is! String ||
        (data['accessToken'] as String).isEmpty) {
      throw const ApiError('认证响应不完整，请重新登录');
    }
    _accessToken = data['accessToken'] as String;
  }

  /// 登录 [address] 与原始 [password]；清除旧身份，等待 Cookie 保存后进入业务页。
  Future<void> login(String address, String password) async {
    await clearSession(notify: false);
    // 登录期间的身份标记，避免被另外的清理操作覆盖。
    final identity = generation;
    try {
      // 登录为公共请求，失败 401 不触发刷新。
      final data = await request(
        '/auth/login',
        method: 'POST',
        protected: false,
        body: {'email': address.trim().toLowerCase(), 'password': password},
      );
      if (identity != generation) {
        throw const ApiError('会话已变更，请重新登录');
      }
      _acceptToken(data);
      email = address.trim().toLowerCase();
      phase = SessionPhase.signedIn;
      notifyListeners();
    } catch (error) {
      // [error] 为登录或落盘失败，不能假装建立了可恢复会话。
      if (identity == generation) {
        await clearSession(notify: false);
      }
      rethrow;
    }
  }

  /// 服务端撤销当前会话，失败保留身份；成功后再执行本机清理。
  Future<void> logout() async {
    await request('/auth/logout', method: 'POST');
    await clearSession();
  }

  /// 立即撤销内存身份并取消请求，然后串行清除 Cookie；清理失败阻止继续使用旧账号。
  /// [notify] 为 false 时登录表单保持可见，普通失败不丢失用户输入。
  Future<void> clearSession({bool notify = true}) =>
      _cleanupTask ??= _clearSession(notify: notify).whenComplete(() {
        _cleanupTask = null;
      });

  /// 执行唯一清理任务。[notify] 为 false 时普通登录失败保留原表单。
  Future<void> _clearSession({required bool notify}) async {
    generation++;
    _refreshTask = null;
    _accessToken = null;
    email = null;
    // 每个旧请求立即取消，Cookie 保存锁仍能阻止已返回的迟到响应。
    for (final token in _requests.toList()) {
      token.cancel('会话已变更');
    }
    _requests.clear();
    phase = SessionPhase.restoring;
    if (notify) {
      notifyListeners();
    }
    try {
      if (!browserManagedCookies) {
        await _gate.run(() async {
          if (storage is SecureCookieStorage) {
            // Jar 损坏时也要能清理完整命名空间，不能依赖损坏索引。
            await (storage as SecureCookieStorage).clearNamespace();
          } else {
            await jar.deleteAll();
          }
        });
      }
      _needsCleanup = false;
      recoveryError = null;
      dio.close(force: true);
      refreshDio.close(force: true);
      _configure();
      phase = SessionPhase.signedOut;
    } catch (error) {
      // [error] 为本机清理失败，旧内存身份已撤销，只允许重试清理。
      _needsCleanup = true;
      phase = SessionPhase.recoveryFailed;
      recoveryError = const ApiError('凭证清理失败，请重试本机清理');
      rethrow;
    } finally {
      if (notify) {
        notifyListeners();
      }
    }
  }

  /// 释放客户端及活动请求；Provider 销毁时不删除可恢复凭证。
  @override
  void dispose() {
    generation++;
    dio.close(force: true);
    refreshDio.close(force: true);
    super.dispose();
  }
}
