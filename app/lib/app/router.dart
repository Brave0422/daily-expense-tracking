import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/network/api_client.dart';
import '../core/providers.dart';
import '../core/widgets/common.dart';
import '../features/account/presentation/account_page.dart';
import '../features/auth/presentation/auth_page.dart';
import '../features/categories/presentation/categories_page.dart';
import '../features/statistics/presentation/statistics_page.dart';
import '../features/tags/presentation/tags_page.dart';
import '../features/transactions/data/transaction.dart';
import '../features/transactions/presentation/transaction_editor.dart';
import '../features/transactions/presentation/transactions_page.dart';

/// 身份序号变化重建路由树，清除旧账号导航分支及表单。
final routerProvider = Provider<GoRouter>((ref) {
  ref.watch(sessionProvider.select((session) => session.generation));
  // 客户端负责认证通知，不重复维护刷新状态。
  final client = ref.watch(apiClientProvider);
  // 二级页面覆盖主导航的根 Navigator。
  final root = GlobalKey<NavigatorState>();
  // 当前账号专属路由对象，销毁时释放认证监听。
  final router = GoRouter(
    navigatorKey: root,
    initialLocation: '/bootstrap',
    refreshListenable: client,
    // [context] 为导航上下文；[state] 是目标地址，恢复未完成只能进入启动页。
    redirect: (context, state) {
      // 未登录允许的账户页面集合。
      final guest = [
        '/login',
        '/register',
        '/forgot-password',
      ].contains(state.matchedLocation);
      if (client.phase == SessionPhase.restoring ||
          client.phase == SessionPhase.recoveryFailed) {
        return state.matchedLocation == '/bootstrap' ? null : '/bootstrap';
      }
      if (client.phase == SessionPhase.signedOut) {
        return guest ? null : '/login';
      }
      return guest || state.matchedLocation == '/bootstrap'
          ? '/transactions'
          : null;
    },
    routes: [
      // 以下 builder 的 [context] 为路由上下文；[state] 仅在编辑路由读取数据。
      GoRoute(
        path: '/bootstrap',
        builder: (context, state) => const BootstrapPage(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const AuthPage(mode: 'login'),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const AuthPage(mode: 'register'),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const AuthPage(mode: 'reset'),
      ),
      // [shell] 是可保留各分支状态的导航容器。
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => BusinessShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/transactions',
                builder: (context, state) => const TransactionsPage(),
                routes: [
                  GoRoute(
                    path: 'create',
                    parentNavigatorKey: root,
                    builder: (context, state) => const TransactionEditor(),
                  ),
                  GoRoute(
                    path: ':id/edit',
                    parentNavigatorKey: root,
                    // [context] 不发请求；[state] 必须携带当前列表提供的真实记录。
                    redirect: (context, state) =>
                        state.extra is TransactionItem &&
                            (state.extra as TransactionItem).id.toString() ==
                                state.pathParameters['id']
                        ? null
                        : '/transactions',
                    builder: (context, state) =>
                        TransactionEditor(item: state.extra as TransactionItem),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/statistics',
                builder: (context, state) => const StatisticsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account',
                builder: (context, state) => const AccountPage(),
                routes: [
                  GoRoute(
                    path: 'categories',
                    parentNavigatorKey: root,
                    builder: (context, state) => const CategoriesPage(),
                  ),
                  GoRoute(
                    path: 'tags',
                    parentNavigatorKey: root,
                    builder: (context, state) => const TagsPage(),
                  ),
                  GoRoute(
                    path: 'change-password',
                    parentNavigatorKey: root,
                    builder: (context, state) => const AuthPage(mode: 'change'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

/// 三个中文底部主导航。
class BusinessShell extends StatelessWidget {
  /// [shell] 提供独立 Navigator；[key] 为标识。
  const BusinessShell({super.key, required this.shell});

  /// 保留各主页面的筛选与滚动。
  final StatefulNavigationShell shell;

  /// 构建底部导航。[context] 提供布局。
  @override
  Widget build(BuildContext context) => Scaffold(
    body: shell,
    bottomNavigationBar: NavigationBar(
      selectedIndex: shell.currentIndex,
      // [index] 为目的地，重复点击不清空当前筛选。
      onDestinationSelected: (index) => shell.goBranch(index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: '流水',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: '统计',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: '我的',
        ),
      ],
    ),
  );
}

/// 安全恢复入口，暂时故障可以重试或清理凭证后重新登录。
class BootstrapPage extends ConsumerWidget {
  /// [key] 为恢复页面标识。
  const BootstrapPage({super.key});

  /// 构建恢复进度。[context] 提供主题；[ref] 为会话依赖。
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 不含 Token 的公开会话快照。
    final session = ref.watch(sessionProvider);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.account_balance_wallet_outlined, size: 64),
                const SizedBox(height: 24),
                const Text('日常记账'),
                const SizedBox(height: 24),
                if (session.phase == SessionPhase.recoveryFailed) ...[
                  ErrorNotice(error: session.error ?? '会话恢复失败'),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: ref.read(apiClientProvider).restore,
                    child: const Text('重试'),
                  ),
                  TextButton(
                    onPressed: () async {
                      try {
                        await ref.read(apiClientProvider).clearSession();
                      } catch (_) {
                        /* 清理失败由会话快照持续显示。 */
                      }
                    },
                    child: const Text('清理凭证并重新登录'),
                  ),
                ] else
                  const CircularProgressIndicator(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
