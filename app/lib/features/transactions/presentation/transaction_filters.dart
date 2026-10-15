import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/common.dart';
import '../../categories/data/category.dart';
import '../application/transaction_query.dart';

/// 日明细和月汇总独立筛选草稿，取消不改变当前查询。
class TransactionFilters extends ConsumerStatefulWidget {
  /// [query] 为当前模式条件；[key] 为组件标识。
  const TransactionFilters({super.key, required this.query});

  /// 原不可变查询条件。
  final TransactionQuery query;

  /// 创建面板内独立草稿。
  @override
  ConsumerState<TransactionFilters> createState() => _TransactionFiltersState();
}

/// 当前面板的条件草稿与校验。
class _TransactionFiltersState extends ConsumerState<TransactionFilters> {
  /// 所有输入校验目标。
  final _form = GlobalKey<FormState>();

  /// 未应用的筛选方向，null 表示全部。
  EntryType? _type;

  /// 本次多选分类真实 ID。
  late Set<int> _categories;

  /// 本次日明细多选标签。
  late Set<int> _tags;

  /// 非负最小金额输入。
  late final TextEditingController _min;

  /// 非负最大金额输入。
  late final TextEditingController _max;

  /// 日明细标题关键词。
  late final TextEditingController _title;

  /// 日明细备注关键词。
  late final TextEditingController _remark;

  /// 筛选金额区间等持续错误。
  Object? _error;

  /// 回填当前模式条件，不混用其他模式草稿。
  @override
  void initState() {
    super.initState();
    _type = widget.query.type;
    _categories = widget.query.categoryIds.toSet();
    _tags = widget.query.tagIds.toSet();
    _min = TextEditingController(text: widget.query.minAmount);
    _max = TextEditingController(text: widget.query.maxAmount);
    _title = TextEditingController(text: widget.query.title);
    _remark = TextEditingController(text: widget.query.remark);
  }

  /// 校验白名单筛选后返回新的不可变查询，不直接请求服务器。
  void _apply() {
    if (!_form.currentState!.validate()) {
      return;
    }
    if (_min.text.isNotEmpty &&
        _max.text.isNotEmpty &&
        yuanToCents(_min.text) > yuanToCents(_max.text)) {
      setState(() => _error = const ApiError('最小金额不得大于最大金额'));
      return;
    }
    Navigator.pop(
      context,
      widget.query.copyWith(
        type: _type,
        categoryIds: _categories.toList(),
        minAmount: _min.text,
        maxAmount: _max.text,
        tagIds: widget.query.monthly ? [] : _tags.toList(),
        title: widget.query.monthly ? '' : _title.text.trim(),
        remark: widget.query.monthly ? '' : _remark.text.trim(),
      ),
    );
  }

  /// 释放筛选控制器。
  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    _title.dispose();
    _remark.dispose();
    super.dispose();
  }

  /// 构建历史分类多选。[type] 为一个方向，归档项可以用于历史筛选。
  Widget _categoryChips(EntryType type) => QueryView(
    value: ref.watch(categoriesProvider((type: type, archived: true))),
    retry: () =>
        ref.invalidate(categoriesProvider((type: type, archived: true))),
    // [roots] 为历史分类树，一级支出表示全部子类。
    builder: (roots) => Wrap(
      spacing: 8,
      children: [
        // [root] 为一级项；[category] 为展开后可筛选的一级 / 二级项。
        for (final root in roots)
          for (final category in [root, ...root.children])
            FilterChip(
              label: Text(
                '${category.level == 2 ? '${root.name} / ' : ''}${category.name}${category.archived ? '（已删除）' : ''}',
              ),
              selected: _categories.contains(category.id),
              // [selected] 为新的选中状态，取消面板不会应用。
              onSelected: (selected) => setState(() {
                selected
                    ? _categories.add(category.id)
                    : _categories.remove(category.id);
              }),
            ),
      ],
    ),
  );

  /// 构建可滚动筛选面板。[context] 提供主题与键盘避让。
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .75,
        child: SingleChildScrollView(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '筛选流水',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(
                        context,
                        TransactionQuery(
                          period: widget.query.period,
                          monthly: widget.query.monthly,
                        ),
                      ),
                      child: const Text('重置'),
                    ),
                  ],
                ),
                DropdownButtonFormField<String>(
                  initialValue: _type?.name ?? 'all',
                  decoration: const InputDecoration(labelText: '收支'),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('全部')),
                    DropdownMenuItem(value: 'expense', child: Text('支出')),
                    DropdownMenuItem(value: 'income', child: Text('收入')),
                  ],
                  // [value] 改方向时清理不兼容分类，all 不发送给后端。
                  onChanged: (value) => setState(() {
                    _type = value == 'all'
                        ? null
                        : EntryType.values.byName(value!);
                    _categories.clear();
                  }),
                ),
                const SizedBox(height: 16),
                const Text('分类（多选）'),
                if (_type != EntryType.income)
                  _categoryChips(EntryType.expense),
                if (_type != EntryType.expense)
                  _categoryChips(EntryType.income),
                TextFormField(
                  controller: _min,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: '最小金额（元）'),
                  // [text] 为空省略，否则允许零且精确解析。
                  validator: (text) => text == null || text.isEmpty
                      ? null
                      : validateAmount(text, positive: false),
                ),
                TextFormField(
                  controller: _max,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: '最大金额（元）'),
                  // [text] 为空省略，否则允许零且精确解析。
                  validator: (text) => text == null || text.isEmpty
                      ? null
                      : validateAmount(text, positive: false),
                ),
                if (!widget.query.monthly) ...[
                  const SizedBox(height: 16),
                  const Text('标签（任一匹配）'),
                  QueryView(
                    value: ref.watch(tagsProvider((key: '', archived: true))),
                    retry: () =>
                        ref.invalidate(tagsProvider((key: '', archived: true))),
                    // [tags] 为历史筛选项，不按名字替换 ID。
                    builder: (tags) => Wrap(
                      spacing: 8,
                      children: [
                        // [tag] 为真实历史标签。
                        for (final tag in tags)
                          FilterChip(
                            label: Text(
                              '${tag.name}${tag.archived ? '（已删除）' : ''}',
                            ),
                            selected: _tags.contains(tag.id),
                            // [selected] 为标签选择状态。
                            onSelected: (selected) => setState(() {
                              selected
                                  ? _tags.add(tag.id)
                                  : _tags.remove(tag.id);
                            }),
                          ),
                      ],
                    ),
                  ),
                  TextFormField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: '标题关键词'),
                    // [text] 与标题接口上限一致。
                    validator: (text) => validateText(text, 50),
                  ),
                  TextFormField(
                    controller: _remark,
                    decoration: const InputDecoration(labelText: '备注关键词'),
                    // [text] 与备注接口上限一致。
                    validator: (text) => validateText(text, 100),
                  ),
                ],
                if (_error != null) ErrorNotice(error: _error!),
                const SizedBox(height: 20),
                FilledButton(onPressed: _apply, child: const Text('应用筛选')),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
