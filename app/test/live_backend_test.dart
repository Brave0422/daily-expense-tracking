import 'dart:io';

import 'package:daily_expense_tracking/core/network/api_client.dart';
import 'package:daily_expense_tracking/core/network/api_service.dart';
import 'package:daily_expense_tracking/core/network/book_repository.dart';
import 'package:daily_expense_tracking/core/utils/values.dart';
import 'package:daily_expense_tracking/features/categories/data/category.dart';
import 'package:daily_expense_tracking/features/statistics/application/statistics_query.dart';
import 'package:daily_expense_tracking/features/transactions/application/transaction_query.dart';
import 'package:daily_expense_tracking/features/transactions/data/transaction.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';

/// 真后端契约闭环测试；只在显式启用且提供固定开发验证码时注册独立测试账号。
void main() {
  // 默认单元测试不写真实服务器。
  const enabled = bool.fromEnvironment('RUN_LIVE_TESTS');
  // 真实验证走 Dio 原生网络；仅平台安全存储使用内存替身。
  test(
    '真实后端：注册、登录、配置、流水、统计、删除、恢复、退出',
    () async {
      // 仅从运行环境读取开发固定码，不输出到报告或日志。
      final code = Platform.environment['LIVE_TEST_CODE'];
      if (code == null || !RegExp(r'^\d{6}$').hasMatch(code)) {
        fail('请提供开发环境六位 LIVE_TEST_CODE');
      }
      // 本轮测试名称，避免污染真实用户的数据。
      final suffix = DateTime.now().microsecondsSinceEpoch.toString();
      // 独立测试账号，无需真实发送邮件。
      final address = 'mobile-test-$suffix@example.com';
      // 测试专用密码，进程结束后不保存在仓库。
      final password = 'T${suffix.substring(suffix.length - 12)}';
      // 独立 Cookie 存储，不读取用户现有会话。
      final storage = MemoryStorage();
      // 本机真服务地址，可以通过环境变量覆盖。
      final uri = Uri.parse(
        Platform.environment['LIVE_API_URL'] ?? 'http://localhost:3000',
      );
      // 正式网络传输客户端，没有 HTTP 适配器替身。
      final client = ApiClient(uri, storage);
      addTearDown(client.dispose);
      // 使用应用相同的服务和模型解析路径。
      final service = ApiService(client);
      // 模块写入刷新通知在契约测试中不需要 UI。
      final repository = BookRepository(service, () {});
      // 读请求控制器，所有查询沿用相同客户端。
      final cancel = CancelToken();
      // 本轮业务自然日期和月份。
      final date = naturalDate(DateTime.now());
      // 固定码仍须先调用发送接口建立用途记录；测试服务配置为不发真实邮件。
      await service.write('/verification-codes/send', {
        'email': address,
        'purpose': 'register',
      }, protected: false);
      expect(
        await service.write('/auth/register', {
          'email': address,
          'password': password,
          'code': code,
        }, protected: false),
        true,
      );
      await client.login(address, password);
      // 当前账号修改密码只提交 purpose，验证码邮箱由服务端根据会话获取。
      await service.write('/verification-codes/send', {
        'purpose': 'change_password',
      });
      expect(
        await service.write('/auth/changePassword', {
          'newPassword': password,
          'code': code,
        }),
        true,
      );
      // 使用真实图库键，绝不编造图标或分类 ID。
      final icons = await repository.icons(cancel);
      expect(icons, isNotEmpty);
      await repository.save('/categories/create', {
        'type': 'expense',
        'name': '移动测试一级$suffix',
        'iconKey': icons.first.iconKey,
      });
      // 查询后取得创建的父分类真实 ID，写接口不返回实体。
      final roots = await repository.categories(
        EntryType.expense,
        false,
        cancel,
      );
      // 测试专属一级目标。
      final parent = roots.singleWhere(
        (category) => category.name == '移动测试一级$suffix',
      );
      await repository.save('/categories/create', {
        'type': 'expense',
        'name': '移动测试二级$suffix',
        'iconKey': icons.last.iconKey,
        'parentId': parent.id,
      });
      // 本次可用于流水的真实二级分类。
      final child = (await repository.categories(
        EntryType.expense,
        false,
        cancel,
      )).singleWhere((category) => category.id == parent.id).children.single;
      await repository.save('/transactions', {
        'type': 'expense',
        'categoryId': child.id,
        'amount': '12.50',
        'occurredDate': date,
        'title': '移动验收$suffix',
        'remark': '真后端契约测试😀',
        'tagNames': ['移动标签$suffix'],
      });
      // 返回记录用于编辑，不能调用不存在的详情端点。
      final daily = await repository.transactions(
        TransactionQuery(period: date.substring(0, 7)),
        cancel,
      ) as DailyResult;
      // 当前测试唯一记录，所有 ID 从服务端取得。
      final item = daily.days
          .expand((day) => day.transactions)
          .singleWhere((transaction) => transaction.title == '移动验收$suffix');
      expect(item.amount, '12.50');
      expect(item.tags, hasLength(1));
      await repository.save('/transactions/${item.id}', {
        'categoryId': child.id,
        'amount': '20.01',
        'occurredDate': date,
        'title': null,
        'remark': null,
        'tagIds': [item.tags.single.id],
        'tagUpdates': [
          {'id': item.tags.single.id, 'name': '移动标签改名$suffix'},
        ],
      }, method: 'PATCH');
      // 单独验证三个端点白名单和精确结果。
      for (final panel in ['ranking', 'proportion', 'trend']) {
        // [panel] 为三个真实统计接口类型。
        // 查询结果直接使用服务端聚合。
        final result = await repository.statistics(
          StatisticsQuery(
            panel: panel,
            month: date.substring(0, 7),
            year: date.substring(0, 4),
          ),
          cancel,
        );
        expect(result.totalAmount, '20.01');
      }
      expect(
        (await repository.transactions(
          TransactionQuery(period: date.substring(0, 4), monthly: true),
          cancel,
        ) as MonthlyResult).totals.expense,
        '20.01',
      );
      await repository.save('/transactions/${item.id}', {
        'categoryId': child.id,
        'amount': '20.01',
        'occurredDate': date,
        'title': null,
        'remark': null,
        'tagIds': <int>[],
      }, method: 'PATCH');
      await repository.save(
        '/transactions/${item.id}/archive',
        null,
        method: 'DELETE',
      );
      await repository.save(
        '/tags/${item.tags.single.id}/archive',
        null,
        method: 'DELETE',
      );
      await repository.save(
        '/categories/${child.id}/archive',
        null,
        method: 'DELETE',
      );
      await repository.save(
        '/categories/${parent.id}/archive',
        null,
        method: 'DELETE',
      );
      // 新客户端复用完整 Cookie，证明接口不需要 JSON Refresh Token。
      final restarted = ApiClient(uri, storage);
      addTearDown(restarted.dispose);
      await restarted.restore();
      expect(restarted.phase, SessionPhase.signedIn);
      await restarted.logout();
      // 退出之后不能通过 Cookie 再恢复。
      final loggedOut = ApiClient(uri, storage);
      addTearDown(loggedOut.dispose);
      await loggedOut.restore();
      expect(loggedOut.phase, SessionPhase.signedOut);
      // 忘记密码是公共接口，不触发自动认证刷新，成功后不自动登录。
      await service.write('/verification-codes/send', {
        'purpose': 'reset_password',
        'email': address,
      }, protected: false);
      expect(
        await service.write('/auth/resetPassword', {
          'email': address,
          'newPassword': password,
          'code': code,
        }, protected: false),
        true,
      );
      expect(loggedOut.phase, SessionPhase.signedOut);
    },
    skip: !enabled,
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
