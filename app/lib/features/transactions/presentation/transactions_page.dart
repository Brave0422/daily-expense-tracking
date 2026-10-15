import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/category_icon.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/period_control.dart';
import '../../categories/data/category.dart';
import '../application/transaction_query.dart';
import '../data/transaction.dart';
import 'transaction_filters.dart';

/// 流水主页面，底部导航保留本账号的模式、筛选和滚动位置。
class TransactionsPage extends ConsumerStatefulWidget {
  /// [key] 在账号切换时清除当前状态。
  const TransactionsPage({super.key});

  /// 创建独立日明细 / 月汇总查询草稿。
  @override
  ConsumerState<TransactionsPage> createState() => _TransactionsPageState();
}

/// 查询条件与删除错误只存活于当前账号页面。
class _TransactionsPageState extends ConsumerState<TransactionsPage> {
  /// 默认当前自然月的日明细条件。
  TransactionQuery _daily = TransactionQuery(
    period: naturalMonth(DateTime.now()),
  );

  /// 独立的当前自然年汇总条件。
  TransactionQuery _monthly = TransactionQuery(
    period: DateTime.now().year.toString(),
    monthly: true,
  );

  /// 当前列表模式。
  bool _isMonthly = false;

  /// 删除流水动作锁。
  bool _busy = false;

  /// 持续显示删除失败。
  Object? _error;

  /// 当前可见模式的不可变条件。
  TransactionQuery get _query => _isMonthly ? _monthly : _daily;

  /// 应用 [query] 到对应模式，不影响另一模式条件。
  void _update(TransactionQuery query) => setState(() {
    query.monthly ? _monthly = query : _daily = query;
  });

  /// 打开独立筛选面板，取消保持原查询。
  Future<void> _filter() async {
    // 应用后才返回新的有效查询。
    final query = await showModalBottomSheet<TransactionQuery>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      // [context] 是面板上下文，查询草稿由子页面管理。
      builder: (context) => TransactionFilters(query: _query),
    );
    if (query != null && mounted) {
      _update(query);
    }
  }

  /// 删除 [item]，独占标签后续状态以服务端重查为准。
  Future<void> _delete(TransactionItem item) async {
    if (_busy ||
        !await confirm(
          context,
          '删除这笔${item.type.label}？',
          '${item.title ?? item.category.primary.name} ${money(item.amount)}\n仅此记录使用的标签也可能被删除。',
          action: '删除',
        ) ||
        !mounted) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(repositoryProvider)
          .save('/transactions/${item.id}/archive', null, method: 'DELETE');
      if (mounted) {
        toast(context, '流水已删除');
      }
    } catch (error) {
      // [error] 保留上下文，列表只在服务端成功后失效重查。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 展示服务端全周期 [totals] 和筛选 [filtered]，不使用本地加总。
  Widget _overview(Totals totals, Totals filtered) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _isMonthly ? '全年总览' : '本月总览',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            '结余 ${money(totals.balance ?? '0')}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 24,
            runSpacing: 8,
            children: [
              Text('收入 ${money(totals.income)}'),
              Text('支出 ${money(totals.expense)}'),
            ],
          ),
          if (_query.filtered) ...[
            const Divider(),
            Text(
              '筛选合计：收入 ${money(filtered.income)} / 支出 ${money(filtered.expense)}',
            ),
          ],
        ],
      ),
    ),
  );

  /// 构建单笔 [item] 的历史展示和明确操作。
  Widget _item(TransactionItem item) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    child: InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: _busy
          ? null
          : () => context.push('/transactions/${item.id}/edit', extra: item),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CategoryIcon(
                  iconKey:
                      item.category.secondary?.iconKey ??
                      item.category.primary.iconKey,
                  color:
                      item.category.secondary?.backgroundColor ??
                      item.category.primary.backgroundColor,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title ??
                            item.category.secondary?.name ??
                            item.category.primary.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        '${item.category.primary.name}${item.category.secondary == null ? '' : ' / ${item.category.secondary?.name}'}'
                        '${item.category.primary.archived || item.category.secondary?.archived == true ? '（已删除）' : ''}',
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  enabled: !_busy,
                  tooltip: '流水操作',
                  // [action] 为明确的编辑或删除；菜单点击不触发行导航。
                  onSelected: (action) => action == 'edit'
                      ? context.push(
                          '/transactions/${item.id}/edit',
                          extra: item,
                        )
                      : _delete(item),
                  // [context] 为菜单上下文。
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'edit', child: Text('编辑')),
                    PopupMenuItem(value: 'delete', child: Text('删除')),
                  ],
                ),
              ],
            ),
            Text(
              '${item.type.label} ${item.type == EntryType.expense ? '-' : '+'}${money(item.amount)}',
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (item.tags.isNotEmpty)
              Wrap(
                spacing: 8,
                children: [
                  // [tag] 保留归档历史名称，不视为不存在。
                  for (final tag in item.tags)
                    Text('#${tag.name}${tag.archived ? '（已删除）' : ''}'),
                ],
              ),
            if (item.remark?.isNotEmpty == true)
              Text(item.remark!, maxLines: 3, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    ),
  );

  /// 展示后端分类汇总 [category]，含二级金额，保留归档历史标记。
  Widget _summaryCategory(Category category) => ExpansionTile(
    leading: CategoryIcon(
      iconKey: category.iconKey,
      color: category.backgroundColor,
      size: 32,
    ),
    title: Text('${category.name}${category.archived ? '（已删除）' : ''}'),
    subtitle: Text(money(category.amount ?? '0')),
    children: [
      // [child] 为二级汇总，金额直接取接口返回。
      for (final child in category.children)
        ListTile(
          title: Text('${child.name}${child.archived ? '（已删除）' : ''}'),
          subtitle: Text(money(child.amount ?? '0')),
        ),
    ],
  );

  /// 构建 [data] 的懒加载分组列表，不向无分页接口发送分页参数。
  Widget _results(Object data) {
    // 将日分组转换为可懒构建的行描述，保持接口顺序。
    final rows = <Object>[];
    if (data is DailyResult) {
      rows.add(_overview(data.totals, data.filterTotals));
      // [day] 按后端日期分组顺序展示。
      for (final day in data.days) {
        rows.add(day);
        rows.addAll(day.transactions);
      }
    } else if (data is MonthlyResult) {
      rows.add(_overview(data.totals, data.filterTotals));
      rows.addAll(data.months);
    }
    if (rows.length == 1) {
      rows.add(
        Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            children: [
              Text(_query.filtered ? '筛选无匹配流水' : '当前周期暂无流水'),
              if (_query.filtered)
                TextButton(
                  onPressed: () => _update(
                    TransactionQuery(
                      period: _query.period,
                      monthly: _query.monthly,
                    ),
                  ),
                  child: const Text('重置筛选'),
                ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(transactionsProvider(_query));
        try {
          await ref.read(transactionsProvider(_query).future);
        } catch (_) {
          /* 查询失败由 QueryView 持续显示。 */
        }
      },
      child: ListView.builder(
        key: PageStorageKey(_isMonthly),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(8, 0, 8, 100),
        itemCount: rows.length,
        // [context] 提供主题；[index] 是当前可见行。
        itemBuilder: (context, index) {
          // 根据行类型懒构建，单笔仍按返回順序。
          final row = rows[index];
          if (row is Widget) {
            return row;
          }
          if (row is TransactionItem) {
            return _item(row);
          }
          if (row is DailyGroup) {
            return Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                '${row.date}  支出 ${money(row.expenseTotal)}  收入 ${money(row.incomeTotal)}',
              ),
            );
          }
          if (row is MonthlyGroup) {
            return Card(
              child: ExpansionTile(
                title: Text('${row.month}月'),
                subtitle: Text(
                  '支出 ${money(row.expenseTotal)} / 收入 ${money(row.incomeTotal)}',
                ),
                children: [
                  const Text('支出分类'),
                  ...row.expenseCategories.map(_summaryCategory),
                  const Text('收入分类'),
                  ...row.incomeCategories.map(_summaryCategory),
                  TextButton(
                    onPressed: () => setState(() {
                      // 汇总跳转日明细只继承兼容筛选，不传标题、标签或备注。
                      _daily = TransactionQuery(
                        period:
                            '${_monthly.period}-${row.month.toString().padLeft(2, '0')}',
                        type: _monthly.type,
                        categoryIds: _monthly.categoryIds,
                        minAmount: _monthly.minAmount,
                        maxAmount: _monthly.maxAmount,
                      );
                      _isMonthly = false;
                    }),
                    child: const Text('查看该月明细'),
                  ),
                ],
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  /// 构建当前模式查询。[context] 提供导航和主题。
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('流水'),
      actions: [
        IconButton(
          tooltip: '筛选流水',
          onPressed: _filter,
          icon: Icon(
            _query.filtered ? Icons.filter_alt : Icons.filter_alt_outlined,
          ),
        ),
      ],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: _busy ? null : () => context.push('/transactions/create'),
      icon: const Icon(Icons.add),
      label: const Text('记一笔'),
    ),
    body: Column(
      children: [
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('日明细')),
            ButtonSegment(value: true, label: Text('月汇总')),
          ],
          selected: {_isMonthly},
          // [selection] 切换模式时保留各自的条件。
          onSelectionChanged: (selection) =>
              setState(() => _isMonthly = selection.first),
        ),
        PeriodControl(
          period: _query.period,
          yearly: _isMonthly,
          // [period] 为合法的新周期，旧 Provider 随条件变化取消。
          onChanged: (period) => _update(_query.copyWith(period: period)),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: ErrorNotice(error: _error!),
          ),
        Expanded(
          child: QueryView(
            value: ref.watch(transactionsProvider(_query)),
            retry: () => ref.invalidate(transactionsProvider(_query)),
            builder: _results,
          ),
        ),
      ],
    ),
  );
}
