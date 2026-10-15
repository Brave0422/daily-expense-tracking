import 'package:daily_expense_tracking/core/config/app_config.dart';
import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/providers.dart';
import 'package:daily_expense_tracking/core/storage/secure_cookie_storage.dart';
import 'package:daily_expense_tracking/core/utils/values.dart';
import 'package:daily_expense_tracking/features/categories/data/category.dart';
import 'package:daily_expense_tracking/features/transactions/application/transaction_query.dart';
import 'package:daily_expense_tracking/features/transactions/data/transaction.dart';
import 'package:daily_expense_tracking/main.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

/// 设备测试使用独立测试账号和安全存储空间，验证真实插件与导航组合。
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  // 仅使用调用者显式提供的测试账号，默认不写真实服务。
  const email = String.fromEnvironment('E2E_EMAIL');
  // 测试账号密码由运行参数提供，不提交仓库。
  const password = String.fromEnvironment('E2E_PASSWORD');
  // [tester] 操作真设备 Widget；网络和安全插件均使用正式实现。
  testWidgets('设备登录、记账编辑、统计、删除和退出闭环', (tester) async {
    // 真平台安全 Cookie 存储，不与正式应用命名空间混用。
    final client = ApiClient(
      AppConfig.apiUri,
      SecureCookieStorage(
        const FlutterSecureStorage(),
        'det:e2e:${Uri.encodeComponent(AppConfig.apiUri.toString())}',
      ),
    );
    addTearDown(client.dispose);
    await client.clearSession();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(client)],
        child: const DailyExpenseApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, '邮箱'), email);
    await tester.enterText(find.widgetWithText(TextFormField, '密码'), password);
    await tester.tap(find.widgetWithText(FilledButton, '登录'));
    await tester.pumpAndSettle();
    expect(find.text('记一笔'), findsOneWidget);
    // 当前应用真实 ProviderContainer，复用相同 Repository 和失效策略。
    final container = ProviderScope.containerOf(
      tester.element(find.byType(DailyExpenseApp)),
    );
    // 当前账号数据访问，配置必须已存在可用二级分类。
    final repository = container.read(repositoryProvider);
    // 设备读请求取消标识。
    final cancel = CancelToken();
    // 取真实分类，不生成本地业务 ID。
    final categories = await repository.categories(
      EntryType.expense,
      false,
      cancel,
    );
    // 用可用二级分类执行本次验收。
    final child = categories.expand((category) => category.children).first;
    // 区分本次测试记录，结束时仅删除此记录及独占标签。
    final marker = '设备验收${DateTime.now().millisecondsSinceEpoch}';
    // 当前自然日期，进入当前月份可见列表。
    final date = naturalDate(DateTime.now());
    await repository.save('/transactions', {
      'type': 'expense',
      'categoryId': child.id,
      'amount': '12.50',
      'occurredDate': date,
      'title': marker,
      'tagNames': [marker],
    });
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text(marker).first);
    await tester.tap(find.text(marker).first);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, '金额（元）'),
      '20.01',
    );
    await tester.ensureVisible(find.text('保存流水'));
    await tester.tap(find.text('保存流水'));
    await tester.pumpAndSettle();
    // 真后端查询确认精确编辑结果，而不只断言成功提示。
    final daily = await repository.transactions(
      TransactionQuery(period: date.substring(0, 7)),
      cancel,
    ) as DailyResult;
    // 本轮唯一记录的真实 ID 与关联标签。
    final item = daily.days
        .expand((day) => day.transactions)
        .singleWhere((transaction) => transaction.title == marker);
    expect(item.amount, '20.01');
    await tester.tap(find.text('统计'));
    await tester.pumpAndSettle();
    expect(find.text('收支统计'), findsOneWidget);
    await tester.tap(find.text('占比'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('趋势'));
    await tester.pumpAndSettle();
    await repository.save(
      '/transactions/${item.id}/archive',
      null,
      method: 'DELETE',
    );
    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('退出登录'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '退出'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, '登录'), findsOneWidget);
    expect(
      await client.jar.loadForRequest(
        Uri.parse('${AppConfig.apiUri}/auth/refresh'),
      ),
      isEmpty,
    );
  }, skip: email.isEmpty || password.isEmpty);
}
