/**
 * @author Brave
 * @date 2026-9-3 14:30:29
 * @description 通用响应格式
 */

export class ApiResponseDto<T> {
  // 业务状态码
  readonly code: number;

  // 响应消息文本
  readonly msg: string;

  // 响应数据主体
  readonly data: T;

  // 是否成功
  readonly success: boolean;

  // 时间戳
  readonly timestamp?: string;

  /**
   * 构造函数
   * @param code - 业务状态码
   * @param msg - 响应消息
   * @param data - 响应数据
   * @param success - 是否成功
   */
  constructor(code: number, msg: string, data: T, success: boolean) {
    // 设置业务状态码
    this.code = code;
    // 设置响应消息
    this.msg = msg;
    // 设置响应数据
    this.data = data;
    // 设置成功标识
    this.success = success;
    // 设置时间戳
    this.timestamp = new Date().toISOString();
  }

  /**
   * 创建成功响应
   * @param data - 响应数据
   * @param msg - 响应消息，默认为"操作成功"
   * @param code - 业务状态码，默认为200
   * @returns 成功响应DTO
   */
  static success<T>(
    data: T,
    msg: string = '操作成功',
    code: number = 200,
  ): ApiResponseDto<T> {
    return new ApiResponseDto<T>(code, msg, data, true);
  }

  /**
   * 创建错误响应
   * @param msg - 错误消息，默认为"操作失败"
   * @param code - 业务错误码，默认为500
   * @param data - 错误数据，默认为null
   * @returns 错误响应DTO
   */
  static error<T>(
    msg: string = '操作失败',
    data: T = null,
    code: number = 500,
  ): ApiResponseDto<T> {
    return new ApiResponseDto(code, msg, data, false);
  }
}
