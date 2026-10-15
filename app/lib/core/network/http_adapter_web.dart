import 'package:dio/browser.dart';
import 'package:dio/dio.dart';

/// 交由浏览器接收和发送 HttpOnly Cookie，支持显式允许的跨域凭证请求。
HttpClientAdapter createPlatformAdapter() =>
    BrowserHttpClientAdapter(withCredentials: true);
