import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_error.dart';

/// 统一异步查询首次加载、错误、重试和结果，不将失败当作空数据。
class QueryView<T> extends StatelessWidget {
  /// [value] 为查询状态；[retry] 重新请求；[builder] 展示真实结果；[key] 为组件标识。
  const QueryView({
    super.key,
    required this.value,
    required this.retry,
    required this.builder,
  });

  /// 当前异步查询。
  final AsyncValue<T> value;

  /// 明确重试动作。
  final VoidCallback retry;

  /// 成功内容构建器。
  final Widget Function(T) builder;

  /// 构建状态视图。[context] 提供主题和布局。
  @override
  Widget build(BuildContext context) => value.when(
    skipLoadingOnRefresh: false,
    // [data] 为已解析的业务结果。
    data: builder,
    loading: () => const Center(
      child: Padding(
        padding: EdgeInsets.all(40),
        child: CircularProgressIndicator(),
      ),
    ),
    // [error] 为本次失败；[stack] 不展示以避免泄露内部信息。
    error: (error, stack) => Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ErrorNotice(error: error),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: retry,
              icon: const Icon(Icons.refresh),
              label: const Text('重试'),
            ),
          ],
        ),
      ),
    ),
  );
}

/// 持续错误块，用于网络、表单、写入失败和不确定结果。
class ErrorNotice extends StatelessWidget {
  /// [error] 为原始或业务错误；[key] 为组件标识。
  const ErrorNotice({super.key, required this.error});

  /// 展示错误，不包含敏感请求数据。
  final Object error;

  /// 使用主题错误色呈现可读文案。[context] 提供配色。
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        ApiError.from(error).message,
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
    ),
  );
}

/// 明确二次确认。[context] 为当前页面；[title]、[message] 为目标说明；
/// [action] 为确认按钮；关闭弹窗返回 false，不产生副作用。
Future<bool> confirm(
  BuildContext context,
  String title,
  String message, {
  String action = '确认',
}) async =>
    await showDialog<bool>(
      context: context,
      // [dialogContext] 仅用于关闭确认弹窗。
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(action),
          ),
        ],
      ),
    ) ??
    false;

/// 轻量成功反馈。[context] 为仍挂载页面；[message] 为实际成功文案。
void toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));

/// 统一处理系统返回与 AppBar 返回，提交期间禁止关闭，草稿需明确放弃。
class DraftGuard extends StatefulWidget {
  /// [dirty] 表示未保存改动；[busy] 表示提交中；[child] 为表单；[key] 为组件标识。
  const DraftGuard({
    super.key,
    required this.dirty,
    required this.busy,
    required this.child,
  });

  /// 是否存在未保存改动。
  final bool dirty;

  /// 是否正在写入。
  final bool busy;

  /// 需要保护的表单页面。
  final Widget child;

  /// 创建局部返回许可状态。
  @override
  State<DraftGuard> createState() => _DraftGuardState();
}

/// 用户确认放弃后只允许一次退出。
class _DraftGuardState extends State<DraftGuard> {
  /// 返回确认后的单次许可。
  bool _allowExit = false;

  /// 构建最新 Flutter 的返回拦截。[context] 为页面导航上下文。
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: _allowExit || (!widget.dirty && !widget.busy),
    // [didPop] 表示已返回；[result] 本表单不依赖返回数据。
    onPopInvokedWithResult: (didPop, result) async {
      if (didPop || widget.busy) {
        return;
      }
      if (await confirm(context, '放弃修改？', '当前输入尚未保存。', action: '放弃') &&
          mounted) {
        setState(() => _allowExit = true);
        // 下一帧 PopScope 更新许可后再返回，避免再次进入确认。
        WidgetsBinding.instance.addPostFrameCallback((time) {
          // [time] 为框架帧时间，返回无需使用。
          if (mounted) {
            Navigator.of(context).pop();
          }
        });
      }
    },
    child: widget.child,
  );
}
