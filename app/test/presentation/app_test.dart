import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/providers.dart';
import 'package:daily_expense_tracking/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fakes.dart';

/// 验证路由访问控制、输入保留、窄屏与表单状态。
void main() {
  // 失败登录不能跳离表单或清空邮箱密码。
  testWidgets('首次恢复不闪业务页面，登录失败保留输入', (tester) async {
    // [tester] 是 Widget 操作与断言工具。
    // 公共登录 401 不应触发刷新。
    var refreshCount = 0;
    // 当前独立测试客户端，不触碰真实安全存储。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      MemoryStorage(),
      adapterFactory: () => FakeAdapter((options) async {
        // [options] 是当前网络请求，用路径检查刷新是否被错误触发。
        if (options.path == '/auth/refresh') {
          refreshCount++;
        }
        return failure(401);
      }),
    );
    addTearDown(client.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(client)],
        child: const DailyExpenseApp(),
      ),
    );
    expect(find.text('记一笔'), findsNothing);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, '邮箱'),
      'TEST@example.com',
    );
    await tester.enterText(find.widgetWithText(TextFormField, '密码'), '123456');
    await tester.tap(find.widgetWithText(FilledButton, '登录'));
    await tester.pumpAndSettle();
    expect(find.text('TEST@example.com'), findsOneWidget);
    expect(find.text('test failure'), findsOneWidget);
    expect(refreshCount, 0);
    expect(tester.takeException(), isNull);
  });

  // 放大字体与窄屏下主导航和录入不得溢出。
  testWidgets('登录后进入流水，窄屏表单校验且保留草稿', (tester) async {
    // [tester] 设置窄屏设备并操作真实路由。
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    // 登录及日明细真实形状替身，其他接口返回空有效列表。
    final client = ApiClient(
      Uri.parse('http://localhost:3000'),
      MemoryStorage(),
      adapterFactory: () => FakeAdapter((options) async {
        // [options] 指示端点，业务请求仍经过完整客户端。
        if (options.path == '/auth/login') {
          return success({
            'accessToken': 'valid',
          }, refreshCookie('valid-cookie'));
        }
        if (options.path == '/transactions/daily') {
          return success({
            'period': '2026-10',
            'totals': {'expense': '0.00', 'income': '0.00', 'balance': '0.00'},
            'filterTotals': {'expense': '0.00', 'income': '0.00'},
            'days': <Object>[],
          });
        }
        return success(<Object>[]);
      }),
    );
    addTearDown(client.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(client)],
        child: const DailyExpenseApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, '邮箱'),
      'test@example.com',
    );
    await tester.enterText(find.widgetWithText(TextFormField, '密码'), '123456');
    await tester.tap(find.widgetWithText(FilledButton, '登录'));
    await tester.pumpAndSettle();
    expect(find.text('当前周期暂无流水'), findsOneWidget);
    await tester.tap(find.text('记一笔'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, '金额（元）'),
      '1.001',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, '标题（选填）'),
      '草稿不会丢失',
    );
    await tester.ensureVisible(find.text('保存流水'));
    await tester.tap(find.text('保存流水'));
    await tester.pumpAndSettle();
    expect(find.text('草稿不会丢失'), findsOneWidget);
    expect(find.text('请输入有效金额，最多13位整数和2位小数'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('放弃修改？'), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(find.text('草稿不会丢失'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
