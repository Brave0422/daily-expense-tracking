import Foundation
import Observation

/// 每次读取有序号与条件标签；旧成功、旧失败和旧结束回调都不能覆盖新查询。
@MainActor @Observable final class QueryState<Value: Sendable> {
    /// 当前会话内存结果。
    var value: Value?
    /// 结果真实所属条件，刷新失败仍显示旧条件。
    var loadedLabel = ""
    /// 首次与刷新共用读取锁。
    var loading = false
    /// 当前有效读取错误。
    var error: String?
    /// 仅成功接收最新响应后递增，供详情快照等依赖结果同步。
    var version = 0
    /// 递增请求序号。
    private var sequence = 0

    /// 最新读取；- Parameters: label: 本次条件；operation: 返回结果的仓库操作；取消不显示错误。
    func load(label: String, operation: () async throws -> Value) async {
        sequence += 1
        /// 当前读取快照序号。
        let request = sequence
        loading = true
        error = nil
        do {
            /// 仓库返回强类型数据。
            let result = try await operation()
            try Task.checkCancellation()
            guard request == sequence else { return }
            value = result
            loadedLabel = label
            version += 1
        } catch is CancellationError {
            // 用户切换条件时不弹失败。
        } catch APIError.staleIdentity {
            // 根路由负责清栈，不把上一身份错误写入新页。
        } catch {
            guard request == sequence, !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }
        if request == sequence { loading = false }
    }
}
