import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_service.dart';
import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/common.dart';

/// 登录、注册、重置和登录态修改密码的共用账户表单。
class AuthPage extends ConsumerStatefulWidget {
  /// [mode] 为 login / register / reset / change；[key] 为页面标识。
  const AuthPage({super.key, required this.mode});

  /// 明确账户用途，验证码用途不可混用。
  final String mode;

  /// 创建并持有敏感表单生命周期。
  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

/// 只保留当前页面敏感输入，离开后销毁。
class _AuthPageState extends ConsumerState<AuthPage>
    with WidgetsBindingObserver {
  /// 本页校验目标。
  final _form = GlobalKey<FormState>();

  /// 邮箱输入，不从 Cookie 解码伪造用户资料。
  final _email = TextEditingController();

  /// 原始密码，不 trim。
  final _password = TextEditingController();

  /// 六位验证码文本，保留前导零。
  final _code = TextEditingController();

  /// 保存动作锁。
  bool _busy = false;

  /// 验证码发送动作锁。
  bool _sending = false;

  /// 默认隐藏密码。
  bool _obscure = true;

  /// 失败时保留输入并持续展示。
  Object? _error;

  /// 实际注册成功后禁止再次注册，即使后续自动登录失败。
  bool _registered = false;

  /// 发送冷却截止时刻，前后台暂停不会改变截止时间。
  DateTime? _sendDeadline;

  /// 仅用于刷新显示，不计时累加冷却。
  Timer? _timer;

  /// 注册前后台监听，返回前台重新计算截止时间。
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  /// [state] 为应用生命周期，恢复前台只刷新显示。
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      setState(() {});
    }
  }

  /// 剩余冷却秒数，使用真实截止时间向上取整。
  int get _remaining => _sendDeadline == null
      ? 0
      : ((_sendDeadline!.difference(DateTime.now()).inMilliseconds / 1000)
                .ceil())
            .clamp(0, 86400);

  /// 当前页面中文标题。
  String get _title => switch (widget.mode) {
    'register' => '创建账号',
    'reset' => '找回密码',
    'change' => '修改密码',
    _ => '欢迎回来',
  };

  /// 精确映射验证码 purpose，不实现账户注销。
  String get _purpose => switch (widget.mode) {
    'register' => 'register',
    'reset' => 'reset_password',
    _ => 'change_password',
  };

  /// 校验 [value] 邮箱，提交时统一 trim 转小写。
  String? _validateEmail(String? value) =>
      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch((value ?? '').trim())
      ? null
      : '请输入有效邮箱';

  /// 设置 [seconds] 冷却，发送失败返回服务端限制时同样尊重。
  void _cooldown(int seconds) {
    _sendDeadline = DateTime.now().add(Duration(seconds: seconds));
    _timer?.cancel();
    // [timer] 只更新 UI；剩余值始终由截止时刻计算。
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remaining == 0) {
        timer.cancel();
      }
      if (mounted) {
        setState(() {});
      }
    });
  }

  /// 发送对应用途验证码；更换邮箱不绕过已有冷却，不发送完整敏感日志。
  Future<void> _send() async {
    if (_remaining > 0 || _sending || _busy) {
      return;
    }
    if (widget.mode != 'change' && _validateEmail(_email.text) != null) {
      setState(() => _error = const ApiError('请先填写有效邮箱'));
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ApiService(
        ref.read(apiClientProvider),
      ).write('/verification-codes/send', {
        'purpose': _purpose,
        if (widget.mode != 'change') 'email': _email.text.trim().toLowerCase(),
      }, protected: widget.mode == 'change');
      if (mounted) {
        _cooldown(60);
        toast(context, '验证码已发送');
      }
    } catch (error) {
      // [error] 可能包含 retryAfterSeconds；保留表单及输入。
      if (mounted) {
        setState(() => _error = error);
        // 服务端发送频控的真实等待秒数。
        final retry = ApiError.from(error).retryAfterSeconds;
        if (retry != null) {
          _cooldown(retry);
        }
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  /// 校验并执行一次账户动作，注册和自动登录的成功边界分别处理。
  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    // 当前统一客户端，敏感值只在请求和本页存在。
    final client = ref.read(apiClientProvider);
    // 账户 Service，不引入额外认证端点。
    final service = ApiService(client);
    try {
      if (widget.mode == 'login' || _registered) {
        await client.login(_email.text, _password.text);
      } else if (widget.mode == 'register') {
        if (await service.write('/auth/register', {
              'email': _email.text.trim().toLowerCase(),
              'password': _password.text,
              'code': _code.text,
            }, protected: false) !=
            true) {
          throw const ApiError('注册响应不完整');
        }
        _registered = true;
        try {
          await client.login(_email.text, _password.text);
        } catch (_) {
          // 注册已成功，不能让用户重复注册同一邮箱。
          throw const ApiError('注册成功，请登录；可点击下方登录入口');
        }
      } else {
        if (await service.write(
              widget.mode == 'change'
                  ? '/auth/changePassword'
                  : '/auth/resetPassword',
              {
                'newPassword': _password.text,
                'code': _code.text,
                if (widget.mode == 'reset')
                  'email': _email.text.trim().toLowerCase(),
              },
              protected: widget.mode == 'change',
            ) !=
            true) {
          throw const ApiError('密码操作响应不完整');
        }
        if (mounted) {
          toast(context, '密码已更新');
          widget.mode == 'change' ? context.pop() : context.go('/login');
        }
      }
    } catch (error) {
      // [error] 为真实操作失败，普通失败保留敏感输入以供修正。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 释放控制器、冷却定时器和前后台监听，清除当前页敏感输入。
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  /// 构建中文、可滚动账户表单。[context] 提供主题和导航。
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.mode == 'login' ? '日常记账' : _title)),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _form,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.account_balance_wallet_outlined, size: 56),
                  const SizedBox(height: 24),
                  Text(
                    _title,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.mode == 'change'
                        ? '验证码发送至当前账号注册邮箱'
                        : '随手记录，让每一笔花费都清晰',
                  ),
                  const SizedBox(height: 28),
                  if (widget.mode != 'change') ...[
                    TextFormField(
                      controller: _email,
                      enabled: !_busy,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(labelText: '邮箱'),
                      validator: _validateEmail,
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextFormField(
                    controller: _password,
                    enabled: !_busy,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: widget.mode == 'login' ? '密码' : '新密码（6–20位）',
                      suffixIcon: IconButton(
                        tooltip: _obscure ? '显示密码' : '隐藏密码',
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    // [value] 是原始密码，以码点检查长度且不 trim。
                    validator: (value) =>
                        value != null &&
                            textLength(value) >= 6 &&
                            textLength(value) <= 20
                        ? null
                        : '密码需为6–20个字符',
                  ),
                  if (widget.mode != 'login' && !_registered) ...[
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _code,
                      enabled: !_busy,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: '六位验证码',
                        suffixIcon: Padding(
                          padding: const EdgeInsets.all(4),
                          child: TextButton(
                            onPressed: _sending || _remaining > 0 || _busy
                                ? null
                                : _send,
                            child: Text(
                              _sending
                                  ? '发送中'
                                  : _remaining > 0
                                  ? '${_remaining}s后重发'
                                  : '发送验证码',
                            ),
                          ),
                        ),
                      ),
                      // [value] 必须精确六位，保留前导零且拒绝尾部换行。
                      validator: (value) =>
                          value != null &&
                              value.length == 6 &&
                              RegExp(r'^\d{6}$').hasMatch(value)
                          ? null
                          : '请输入六位验证码',
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    ErrorNotice(error: _error!),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _busy || _sending ? null : _submit,
                    child: Text(
                      _busy
                          ? '处理中…'
                          : _registered
                          ? '登录已注册账号'
                          : widget.mode == 'login'
                          ? '登录'
                          : '确认',
                    ),
                  ),
                  if (widget.mode == 'login')
                    Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => context.go('/register'),
                          child: const Text('创建账号'),
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => context.go('/forgot-password'),
                          child: const Text('忘记密码'),
                        ),
                      ],
                    )
                  else if (widget.mode != 'change')
                    TextButton(
                      onPressed: _busy ? null : () => context.go('/login'),
                      child: const Text('返回登录'),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
