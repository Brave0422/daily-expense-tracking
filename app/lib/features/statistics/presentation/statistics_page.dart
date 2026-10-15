import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/category_icon.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/period_control.dart';
import '../../categories/data/category.dart';
import '../application/statistics_query.dart';
import '../data/statistics.dart';

/// 三个独立统计板块，仅当前可见板块订阅查询。
class StatisticsPage extends ConsumerStatefulWidget {
  /// [key] 为当前账号页面标识。
  const StatisticsPage({super.key});

  /// 创建独立查询条件。
  @override
  ConsumerState<StatisticsPage> createState() => _StatisticsPageState();
}

/// 保留各板块年月、方向及触摸状态。
class _StatisticsPageState extends ConsumerState<StatisticsPage> {
  /// 当前板块，默认排行。
  String _panel = 'ranking';

  /// 各板块独立默认当前月支出，不共享查询条件。
  final Map<String, StatisticsQuery> _queries = {
    // [panel] 是合法板块名称，日期采用当前设备自然周期。
    for (final panel in ['ranking', 'proportion', 'trend'])
      panel: StatisticsQuery(
        panel: panel,
        month: naturalMonth(DateTime.now()),
        year: DateTime.now().year.toString(),
      ),
  };

  /// 触摸选中的真实分类 ID。
  int? _selectedId;

  /// 获取初始化映射中必定存在的当前条件。
  StatisticsQuery get _query => _queries[_panel]!;

  /// 只更新当前板块 [query]，并清空触摸选中状态。
  void _update(StatisticsQuery query) => setState(() {
    _queries[_panel] = query;
    _selectedId = null;
  });

  /// 由 [id] 稳定计算图表色，独立于分类继承背景。
  Color _color(int id) => HSLColor.fromAHSL(
    1,
    (id * 137.508) % 360,
    .62,
    Theme.of(context).brightness == Brightness.dark ? .64 : .43,
  ).toColor();

  /// [item] 的完整名称，二级补充父类以区分同名分类。
  String _name(StatisticsItem item) =>
      '${item.parent == null ? '' : '${item.parent?.name} / '}${item.name}';

  /// 展示 [items] 完整排行，顺序和百分比服从后端结果。
  Widget _ranking(List<StatisticsItem> items) => Column(
    children: [
      // [i] 是返回顺序中的名次，不按金额字符串重新排序。
      for (var i = 0; i < items.length; i++)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    Text('${i + 1}'),
                    const SizedBox(width: 12),
                    CategoryIcon(
                      iconKey: items[i].iconKey,
                      color: items[i].backgroundColor,
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(_name(items[i]))),
                  ],
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    '${money(items[i].amount)}  ${items[i].percentage}%',
                  ),
                ),
                const SizedBox(height: 8),
                // double 仅用于图形比例，金额和百分比文字保持原精度。
                LinearProgressIndicator(
                  value: (double.parse(items[i].percentage) / 100).clamp(0, 1),
                  color: _color(items[i].categoryId),
                ),
              ],
            ),
          ),
        ),
    ],
  );

  /// 以 [items] 原始金额绘制饼图，点按扇区与文字图例均可选择。
  Widget _proportion(List<StatisticsItem> items) => Column(
    children: [
      SizedBox(
        height: 260,
        child: Semantics(
          label: '分类占比图，下方图例提供完整金额和百分比',
          child: PieChart(
            PieChartData(
              centerSpaceRadius: 48,
              sectionsSpace: 3,
              pieTouchData: PieTouchData(
                // [event] 为触摸状态；[response] 为命中的扇区，空白命中不访问列表。
                touchCallback: (event, response) {
                  // 真实索引可能为 -1，先检查边界。
                  final index = response?.touchedSection?.touchedSectionIndex;
                  if (event.isInterestedForInteractions &&
                      index != null &&
                      index >= 0 &&
                      index < items.length) {
                    setState(() => _selectedId = items[index].categoryId);
                  }
                },
              ),
              sections: [
                // [item] 为真实分类金额，不强制修正四舍五入后的百分比合计。
                for (final item in items)
                  PieChartSectionData(
                    value: double.parse(item.amount),
                    color: _color(item.categoryId),
                    radius: _selectedId == item.categoryId ? 62 : 52,
                    showTitle: false,
                  ),
              ],
            ),
          ),
        ),
      ),
      // [item] 为可触摸的文字图例，金额始终使用原字符串。
      for (final item in items)
        Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: _color(item.categoryId),
              radius: 8,
            ),
            title: Text(_name(item)),
            subtitle: Text('${money(item.amount)} · ${item.percentage}%'),
            selected: _selectedId == item.categoryId,
            onTap: () => setState(() => _selectedId = item.categoryId),
          ),
        ),
    ],
  );

  /// 使用 [result] 状态决定变化方向，不能根据舍入后的比例猜测。
  String _comparison(StatisticsResult result) => switch (result.changeStatus) {
    'new' => '上期为零，本期新增金额',
    'increase' => '相比上期增加 ${result.changeRate ?? '0.00'}%',
    'decrease' =>
      '相比上期减少 ${(result.changeRate ?? '0.00').replaceFirst('-', '')}%',
    _ => '与上期持平',
  };

  /// 展示 [result] 的完整自然周期柱图，保留未来日期和所有零点。
  Widget _trend(StatisticsResult result) {
    // 数据层验证数组存在，不自行截断或重算周期。
    final series = result.series ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '上一完整周期 ${result.previousPeriod}：${money(result.previousTotalAmount ?? '0')}',
        ),
        Text(_comparison(result)),
        const SizedBox(height: 20),
        if (series.every((point) => double.parse(point.amount) == 0))
          const Text('当前周期暂无收支'),
        if (series.isNotEmpty)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: math.max(
                MediaQuery.sizeOf(context).width - 40,
                series.length * 28.0,
              ),
              height: 260,
              child: BarChart(
                BarChartData(
                  minY: 0,
                  alignment: BarChartAlignment.spaceAround,
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    leftTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 30,
                        // [value] 为坐标；[meta] 为框架刻度，仅稀疏显示标签不删数据。
                        getTitlesWidget: (value, meta) =>
                            value.toInt() >= 0 &&
                                value.toInt() < series.length &&
                                value.toInt() % 3 == 0
                            ? Text(series[value.toInt()].date.split('-').last)
                            : const SizedBox.shrink(),
                      ),
                    ),
                  ),
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      // [group] 为柱组；[groupIndex] 对应原日期；[rod] 为柱；[rodIndex] 每组仅一条。
                      getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                          BarTooltipItem(
                            '${series[groupIndex].date}\n${money(series[groupIndex].amount)}',
                            const TextStyle(color: Colors.white),
                          ),
                    ),
                  ),
                  barGroups: [
                    // [i] 对应完整时间轴，double 只参与绘图。
                    for (var i = 0; i < series.length; i++)
                      BarChartGroupData(
                        x: i,
                        barRods: [
                          BarChartRodData(
                            toY: double.parse(series[i].amount),
                            width: 14,
                            color: Theme.of(context).colorScheme.primary,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ExpansionTile(
          title: const Text('查看完整日期与金额'),
          children: [
            // [point] 提供图表的无障碍文字替代。
            for (final point in series)
              ListTile(
                title: Text(point.date),
                subtitle: Text(money(point.amount)),
              ),
          ],
        ),
      ],
    );
  }

  /// 展示 [result] 的总额、笔数和对应图表，统计口径完全使用后端。
  Widget _result(StatisticsResult result) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${result.period} · ${_query.type.label}'),
              const SizedBox(height: 8),
              Text(
                money(result.totalAmount),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              Text(
                '${result.transactionCount}笔 · 完整自然${_query.yearly ? '年' : '月'}',
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      if (_panel == 'trend')
        _trend(result)
      else if (result.items?.isEmpty != false ||
          double.parse(result.totalAmount) == 0)
        const Padding(padding: EdgeInsets.all(40), child: Text('当前周期暂无统计数据'))
      else if (_panel == 'ranking')
        _ranking(result.items!)
      else
        _proportion(result.items!),
    ],
  );

  /// 构建条件与当前板块。[context] 提供分支可见性和主题。
  @override
  Widget build(BuildContext context) {
    // 后台分支关闭 TickerMode，移除隐藏查询订阅但保留条件。
    final visible = TickerMode.valuesOf(context).enabled;
    return Scaffold(
      appBar: AppBar(title: const Text('收支统计')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'ranking', label: Text('排行')),
              ButtonSegment(value: 'proportion', label: Text('占比')),
              ButtonSegment(value: 'trend', label: Text('趋势')),
            ],
            selected: {_panel},
            // [selection] 只切换板块，其他查询不受影响。
            onSelectionChanged: (selection) => setState(() {
              _panel = selection.first;
              _selectedId = null;
            }),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SegmentedButton<EntryType>(
                segments: const [
                  ButtonSegment(value: EntryType.expense, label: Text('支出')),
                  ButtonSegment(value: EntryType.income, label: Text('收入')),
                ],
                selected: {_query.type},
                // [selection] 收入自动回一级。
                onSelectionChanged: (selection) => _update(
                  _query.copyWith(
                    type: selection.first,
                    level: selection.first == EntryType.income
                        ? 1
                        : _query.level,
                  ),
                ),
              ),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('月')),
                  ButtonSegment(value: true, label: Text('年')),
                ],
                selected: {_query.yearly},
                // [selection] 切换月 / 年但保留各自日期。
                onSelectionChanged: (selection) =>
                    _update(_query.copyWith(yearly: selection.first)),
              ),
              if (_panel != 'trend' && _query.type == EntryType.expense)
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(value: 1, label: Text('一级')),
                    ButtonSegment(value: 2, label: Text('二级')),
                  ],
                  selected: {_query.level},
                  // [selection] 层级只影响分类板块。
                  onSelectionChanged: (selection) =>
                      _update(_query.copyWith(level: selection.first)),
                ),
              if (_panel == 'ranking')
                FilterChip(
                  label: Text(_query.ascending ? '金额升序' : '金额降序'),
                  selected: _query.ascending,
                  // [selected] 排行顺序，不带入占比和趋势。
                  onSelected: (selected) =>
                      _update(_query.copyWith(ascending: selected)),
                ),
            ],
          ),
          PeriodControl(
            period: _query.yearly ? _query.year : _query.month,
            yearly: _query.yearly,
            statistics: true,
            // [period] 已校验比较周期边界。
            onChanged: (period) => _update(
              _query.yearly
                  ? _query.copyWith(year: period)
                  : _query.copyWith(month: period),
            ),
          ),
          if (visible)
            QueryView(
              value: ref.watch(statisticsProvider(_query)),
              retry: () => ref.invalidate(statisticsProvider(_query)),
              builder: _result,
            ),
        ],
      ),
    );
  }
}
