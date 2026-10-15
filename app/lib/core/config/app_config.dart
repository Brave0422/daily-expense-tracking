import 'package:flutter/foundation.dart';

/// 集中校验服务地址；Web 默认同源访问，原生端默认使用 Android 模拟器地址。
abstract final class AppConfig {
  /// 可选接口地址；未指定时由运行平台选择默认值。
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// 返回合法服务 URI；发布环境必须使用 HTTPS，否则抛出配置错误。
  static Uri get apiUri {
    // Web 同源访问配合 Flutter 开发代理；真机仍通过 dart-define 指定服务。
    final address = apiBaseUrl.isNotEmpty
        ? apiBaseUrl
        : kIsWeb
        ? Uri.base.origin
        : 'http://10.0.2.2:3000';
    // 保留部署前缀并移除尾部斜线，避免路径重复。
    final uri = Uri.parse(address.replaceFirst(RegExp(r'/+$'), ''));
    if (!uri.hasAuthority ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.hasQuery ||
        uri.hasFragment ||
        uri.userInfo.isNotEmpty) {
      throw const FormatException('API_BASE_URL 必须是有效的 HTTP(S) 地址');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw const FormatException('发布环境必须配置 HTTPS 服务地址');
    }
    return uri;
  }
}
