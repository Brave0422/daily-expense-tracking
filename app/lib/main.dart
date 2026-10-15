import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';

/// 初始化平台绑定和 ProviderScope，随后安全恢复 Cookie 会话。
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: DailyExpenseApp()));
}

/// Android / iOS / Web 中文 Material 3 根应用，跟随系统主题。
class DailyExpenseApp extends ConsumerWidget {
  /// [key] 为应用组件标识。
  const DailyExpenseApp({super.key});

  /// 构建应用。[context] 为根上下文；[ref] 提供登录访问控制路由。
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: '日常记账',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.create(Brightness.light),
    darkTheme: AppTheme.create(Brightness.dark),
    themeMode: ThemeMode.system,
    locale: const Locale('zh', 'CN'),
    supportedLocales: const [Locale('zh', 'CN')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    routerConfig: ref.watch(routerProvider),
  );
}
