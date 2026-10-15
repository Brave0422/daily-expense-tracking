import 'dart:io';
import 'dart:ui' as ui;

import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/providers.dart';
import 'package:daily_expense_tracking/main.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fakes.dart';

/// 验证窄屏、中文大字体、浅深主题，输出实际 Widget 渲染图供人工检查。
Future<void> main() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  // Flutter Widget 测试默认 Ahem 方块字体，Windows 视觉检查加载系统中文字体。
  final fontFile = File('C:/Windows/Fonts/msyh.ttc');
  if (Platform.isWindows && await fontFile.exists()) {
    // 测试字体仅驻留进程，不把系统字体复制进项目或 APK。
    final loader = FontLoader('Roboto');
    loader.addFont(
      Future<ByteData>.value(
        ByteData.sublistView(await fontFile.readAsBytes()),
      ),
    );
    await loader.load();
  }
  // 测试环境默认不加载图标字体，使用当前 SDK 的 Material 图标。
  final iconFont = File(
    '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (await iconFont.exists()) {
    // 当前 SDK 已下载的图标字体，不复制进源码。
    final icons = FontLoader('MaterialIcons');
    icons.addFont(
      Future<ByteData>.value(
        ByteData.sublistView(await iconFont.readAsBytes()),
      ),
    );
    await icons.load();
  }
  // [brightness] 为两个系统主题，不依赖设备默认设置。
  for (final brightness in [Brightness.light, Brightness.dark]) {
    // [tester] 提供窄屏设备与帧渲染操作。
    testWidgets('中文1.8倍字体布局 ${brightness.name}', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.8;
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      // 独立 Cookie 存储，测试不会影响真实账号。
      final client = ApiClient(
        Uri.parse('http://localhost:3000'),
        MemoryStorage(),
        adapterFactory: () => FakeAdapter((options) async {
          // [options] 为端点配置，测试数据仅在本文件的替身传输中提供。
          if (options.path == '/auth/login') {
            return success({'accessToken': 'valid'}, refreshCookie('valid'));
          }
          if (options.path == '/transactions/daily') {
            return success({
              'period': '2026-10',
              'totals': {
                'expense': '0.00',
                'income': '0.00',
                'balance': '0.00',
              },
              'filterTotals': {'expense': '0.00', 'income': '0.00'},
              'days': <Object>[],
            });
          }
          if (options.path.startsWith('/statistics/')) {
            return success({
              'period': '2026-10',
              'periodType': 'month',
              'type': 'expense',
              'categoryLevel': 1,
              'transactionCount': 2,
              'totalAmount': '15.71',
              if (options.path.contains('transaction-trend')) ...{
                'previousPeriod': '2026-09',
                'previousTotalAmount': '20.00',
                'changeRate': '-21.45',
                'changeStatus': 'decrease',
                'series': [
                  // [day] 生成完整测试月轴，包含未来零点。
                  for (var day = 1; day <= 31; day++)
                    {
                      'date': '2026-10-${day.toString().padLeft(2, '0')}',
                      'amount': day == 1 ? '15.71' : '0.00',
                    },
                ],
              } else
                'items': [
                  {
                    'categoryId': 1,
                    'name': '午餐',
                    'iconKey': 'icon-expense-meals',
                    'backgroundColor': '#FF873D',
                    'parent': null,
                    'amount': '12.50',
                    'percentage': '79.57',
                  },
                  {
                    'categoryId': 2,
                    'name': '交通',
                    'iconKey': 'icon-expense-meals',
                    'backgroundColor': '#FF873D',
                    'parent': null,
                    'amount': '3.21',
                    'percentage': '20.43',
                  },
                ],
            });
          }
          return success(<Object>[]);
        }),
      );
      addTearDown(client.dispose);
      // 根 RepaintBoundary 用于把实际 Widget 输出为可审阅图像。
      final capture = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: capture,
          child: ProviderScope(
            overrides: [apiClientProvider.overrideWithValue(client)],
            child: const DailyExpenseApp(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.enterText(
        find.widgetWithText(TextFormField, '邮箱'),
        'test@example.com',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, '密码'),
        '123456',
      );
      await tester.ensureVisible(find.widgetWithText(FilledButton, '登录'));
      await tester.tap(find.widgetWithText(FilledButton, '登录'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('统计'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('占比'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byType(PieChart));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      // 图像只作为本地视觉检查产物，build 目录不会提交。
      await tester.runAsync(() async {
        // 当前屏幕实际渲染边界。
        final boundary =
            capture.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        // 导出一倍逻辑像素图，不修改页面内容。
        final image = await boundary.toImage(pixelRatio: 1);
        // PNG 数据用于本地人工检查。
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await Directory('build/ui_preview').create(recursive: true);
        await File('build/ui_preview/statistics_${brightness.name}.png')
            .writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      // 回到顶部，让懒加载列表重新构建板块切换按钮。
      await tester.drag(find.byType(Scrollable).first, const Offset(0, 700));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('趋势'));
      await tester.tap(find.text('趋势'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byType(BarChart));
      await tester.pumpAndSettle();
      expect(find.text('相比上期减少 21.45%'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
