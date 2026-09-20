/**
 * @author Brave
 * @date 2026-09-20T15:23:51+08:00
 * @description 后端统一成功响应与错误响应的共享类型。
 */

export interface ApiResponse<T> {
  /** 业务状态码，成功响应当前为 200。 */
  code: number
  /** 后端提供的业务提示。 */
  msg: string
  /** 当前接口的实际响应数据。 */
  data: T
  /** 业务处理是否成功。 */
  success: boolean
  /** 服务端生成响应的 ISO 时间。 */
  timestamp?: string
}

export interface ApiErrorResponse {
  /** NestJS HTTP 状态码。 */
  statusCode?: number
  /** 单条错误或 ValidationPipe 产生的错误数组。 */
  message?: string | string[]
  /** HTTP 错误类别。 */
  error?: string
  /** 验证码频控要求等待的秒数。 */
  retryAfterSeconds?: number
}
