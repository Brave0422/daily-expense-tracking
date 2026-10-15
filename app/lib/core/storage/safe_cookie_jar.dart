import 'package:cookie_jar/cookie_jar.dart';

/// 补足 Cookie Jar 的 Secure 请求约束，并保留过期及主机路径规则。
class SafeCookieJar extends PersistCookieJar {
  /// [storage] 是平台安全存储；损坏主机数据不自动删除，交给恢复页报告。
  SafeCookieJar(Storage storage)
    : super(
        storage: storage,
        persistSession: true,
        ignoreExpires: false,
        deleteHostCookiesWhenLoadFailed: false,
      );

  /// 按 [uri] 加载 Cookie，Secure 凭证只允许 HTTPS，不能被 HTTP 请求携带。
  @override
  Future<List<Cookie>> loadForRequest(Uri uri) async {
    // 依赖库负责主机、路径和过期匹配，再补充 Secure 传输限制。
    final cookies = await super.loadForRequest(uri);
    return cookies
        .where((cookie) => !cookie.secure || uri.scheme == 'https')
        .toList();
  }
}
