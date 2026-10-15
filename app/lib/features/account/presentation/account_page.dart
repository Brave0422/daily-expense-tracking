import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/widgets/common.dart';

/// 当前会话与配置入口，不依赖不存在的用户资料接口。
class AccountPage extends ConsumerStatefulWidget {
  /// [key] 为页面标识。
  const AccountPage({super.key});

  /// 创建退出锁及错误状态。
  @override
  ConsumerState<AccountPage> createState() => _AccountPageState();
}

/// 退出失败时保留当前有效身份。
class _AccountPageState extends ConsumerState<AccountPage> {
  /// 服务端退出动作锁。
  bool _busy = false;

  /// 持续显示撤销失败。
  Object? _error;

  /// 服务端确认撤销后才清除本机凭证，普通失败允许重试。
  Future<void> _logout() async {
    if (_busy ||
        !await confirm(
          context,
          '退出登录？',
          '退出后将清除本机当前账号的会话与页面草稿。',
          action: '退出',
        ) ||
        !mounted) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).logout();
    } catch (error) {
      // [error] 为服务端撤销或安全清理失败。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 构建账户入口。[context] 提供导航与主题。
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('我的')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            title: Text(ref.watch(sessionProvider).email ?? '已登录'),
            subtitle: const Text('日常记账 · 联网使用'),
          ),
        ),
        const SizedBox(height: 20),
        ListTile(
          leading: const Icon(Icons.category_outlined),
          title: const Text('分类管理'),
          trailing: const Icon(Icons.chevron_right),
          onTap: _busy ? null : () => context.push('/account/categories'),
        ),
        ListTile(
          leading: const Icon(Icons.sell_outlined),
          title: const Text('标签管理'),
          trailing: const Icon(Icons.chevron_right),
          onTap: _busy ? null : () => context.push('/account/tags'),
        ),
        ListTile(
          leading: const Icon(Icons.lock_outline),
          title: const Text('修改密码'),
          trailing: const Icon(Icons.chevron_right),
          onTap: _busy ? null : () => context.push('/account/change-password'),
        ),
        const SizedBox(height: 24),
        if (_error != null) ErrorNotice(error: _error!),
        OutlinedButton.icon(
          onPressed: _busy ? null : _logout,
          icon: const Icon(Icons.logout),
          label: Text(_busy ? '正在退出…' : '退出登录'),
        ),
      ],
    ),
  );
}
