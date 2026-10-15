import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';

/// 可持续显示给用户的失败信息，不携带请求凭证。
class ApiError implements Exception {
  /// 创建错误。[message] 为用户文案；[status] 为 HTTP 状态；[retryAfterSeconds]
  /// 为发送冷却；[uncertain] 表示写入可能已完成，需要先查询确认。
  const ApiError(
    this.message, {
    this.status,
    this.retryAfterSeconds,
    this.uncertain = false,
  });

  /// 可理解的错误信息。
  final String message;

  /// 实际 HTTP 状态；没有响应时为空。
  final int? status;

  /// 服务端规定的再次发送等待秒数。
  final int? retryAfterSeconds;

  /// 超时或连接中断导致写入结果不确定。
  final bool uncertain;

  /// 将 [error] 转换成展示错误。[writing] 指示是否为可能已送出的写请求。
  static ApiError from(Object error, {bool writing = false}) {
    if (error is ApiError) {
      return error;
    }
    if (error is String) {
      return ApiError(error);
    }
    if (error is DioException) {
      if (error.error is CookieManagerSaveException ||
          error.error is CookieManagerLoadException) {
        return const ApiError('安全存储读取或保存失败，请重试；必要时清理凭证重新登录');
      }
      if (error.error is ApiError) {
        return error.error! as ApiError;
      }
      // NestJS 校验错误支持数组，逐项合并，避免只显示第一项。
      final body = error.response?.data;
      // 状态用于区分认证拒绝与临时故障。
      final status = error.response?.statusCode;
      if (body is Map<String, dynamic>) {
        // 后端错误文案可能为字符串或字符串数组。
        final message = body['message'];
        return ApiError(
          message is List
              ? message.join('\n')
              : message is String
              ? message
              : '服务暂时不可用，请重试',
          status: status,
          retryAfterSeconds: body['retryAfterSeconds'] as int?,
        );
      }
      // 请求取消不误报未登录，也不自动重试写入。
      if (error.type == DioExceptionType.cancel) {
        return const ApiError('请求已取消');
      }
      if (writing &&
          status == null &&
          error.type != DioExceptionType.connectionTimeout) {
        return const ApiError('结果尚未确认，请刷新列表确认后再重试', uncertain: true);
      }
      return ApiError(
        status == null ? '网络连接失败，请检查网络后重试' : '服务暂时不可用，请重试',
        status: status,
      );
    }
    return const ApiError('数据或安全存储异常，请重试；必要时重新登录');
  }

  /// 返回可读文案，避免异常打印暴露请求信息。
  @override
  String toString() => message;
}
