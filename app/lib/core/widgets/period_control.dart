import 'package:flutter/material.dart';

/// 检查 [period] 在 [yearly] 对应格式和 [minimum] / [maximum] 边界内。
bool validPeriod(String period, bool yearly, String minimum, String maximum) =>
    (yearly ? RegExp(r'^\d{4}$') : RegExp(r'^\d{4}-(0[1-9]|1[0-2])$')).hasMatch(
      period,
    ) &&
    period.length == (yearly ? 4 : 7) &&
    period.compareTo(minimum) >= 0 &&
    period.compareTo(maximum) <= 0;

/// 可选择任意合法年月并前后切换的公共周期控件。
class PeriodControl extends StatelessWidget {
  /// [period] 为当前年月；[yearly] 表示年；[onChanged] 发布新周期；
  /// [statistics] 启用前后比较周期边界；[key] 为组件标识。
  const PeriodControl({
    super.key,
    required this.period,
    required this.yearly,
    required this.onChanged,
    this.statistics = false,
  });

  /// YYYY-MM 或 YYYY。
  final String period;

  /// 查询完整自然年。
  final bool yearly;

  /// 选择之后触发新查询。
  final ValueChanged<String> onChanged;

  /// 统计需要前后周期在 MySQL 范围内。
  final bool statistics;

  /// 当前允许最小周期。
  String get minimum => statistics
      ? (yearly ? '1001' : '1000-02')
      : (yearly ? '1000' : '1000-01');

  /// 当前允许最大周期。
  String get maximum => statistics
      ? (yearly ? '9998' : '9999-11')
      : (yearly ? '9999' : '9999-12');

  /// 根据 [offset] 计算相邻月 / 年，不通过 UTC 日期偏移。
  String _adjacent(int offset) {
    // 当前选择的年份。
    final year = int.parse(period.substring(0, 4));
    if (yearly) {
      return (year + offset).toString().padLeft(4, '0');
    }
    // 月份构造器负责跨年，未转换成时间戳传输。
    final date = DateTime(year, int.parse(period.substring(5)) + offset);
    return '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}';
  }

  /// 打开年月选择面板。[context] 提供本地导航与主题。
  Future<void> _choose(BuildContext context) async {
    // 输入年份控制器，不建立数千项下拉列表。
    final year = TextEditingController(text: period.substring(0, 4));
    // 本次月份草稿。
    var month = yearly ? 1 : int.parse(period.substring(5));
    // 周期边界校验目标。
    final form = GlobalKey<FormState>();
    try {
      // 本次返回的合法周期，不选择时为空。
      final selected = await showDialog<String>(
        context: context,
        // [dialogContext] 控制弹窗关闭。
        builder: (dialogContext) => StatefulBuilder(
          // [context] 为主题；[update] 只更新弹窗月份草稿。
          builder: (context, update) => AlertDialog(
            title: Text(yearly ? '选择年份' : '选择月份'),
            content: Form(
              key: form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: year,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: '年份'),
                    // [text] 为年份草稿，组合月份后检查前后周期边界。
                    validator: (text) =>
                        validPeriod(
                          yearly
                              ? text ?? ''
                              : '${text ?? ''}-${month.toString().padLeft(2, '0')}',
                          yearly,
                          minimum,
                          maximum,
                        )
                        ? null
                        : '允许范围：$minimum 至 $maximum',
                  ),
                  if (!yearly)
                    DropdownButtonFormField<int>(
                      initialValue: month,
                      decoration: const InputDecoration(labelText: '月份'),
                      items: [
                        // [value] 为自然月份编号。
                        for (var value = 1; value <= 12; value++)
                          DropdownMenuItem(
                            value: value,
                            child: Text('$value月'),
                          ),
                      ],
                      // [value] 为空时保留原月份。
                      onChanged: (value) =>
                          update(() => month = value ?? month),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('取消'),
              ),
              FilledButton(
                onPressed: () {
                  if (form.currentState!.validate()) {
                    Navigator.pop(
                      dialogContext,
                      yearly
                          ? year.text
                          : '${year.text}-${month.toString().padLeft(2, '0')}',
                    );
                  }
                },
                child: const Text('选择'),
              ),
            ],
          ),
        ),
      );
      if (selected != null) {
        onChanged(selected);
      }
    } finally {
      await Future<void>.delayed(const Duration(milliseconds: 300));
      year.dispose();
    }
  }

  /// 构建前后切换与月份选择。[context] 为展示上下文。
  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      IconButton(
        tooltip: yearly ? '上一年' : '上个月',
        onPressed: validPeriod(_adjacent(-1), yearly, minimum, maximum)
            ? () => onChanged(_adjacent(-1))
            : null,
        icon: const Icon(Icons.chevron_left),
      ),
      Flexible(
        child: TextButton.icon(
          onPressed: () => _choose(context),
          icon: const Icon(Icons.calendar_month_outlined),
          label: Text(period),
        ),
      ),
      IconButton(
        tooltip: yearly ? '下一年' : '下个月',
        onPressed: validPeriod(_adjacent(1), yearly, minimum, maximum)
            ? () => onChanged(_adjacent(1))
            : null,
        icon: const Icon(Icons.chevron_right),
      ),
    ],
  );
}
