import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_error.dart';
import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/name_prompt.dart';
import '../../categories/data/category.dart';
import '../../tags/data/tag.dart';
import '../application/tag_drafts.dart';
import '../data/transaction.dart';

/// 新增 / 编辑流水，从当前日明细回填，不请求不存在的单笔详情端点。
class TransactionEditor extends ConsumerStatefulWidget {
  /// [item] 为日明细已有实体或 null 新增；[key] 为页面标识。
  const TransactionEditor({super.key, this.item});

  /// 保持不变的原记录，独立草稿取消不污染列表。
  final TransactionItem? item;

  /// 创建录入生命周期。
  @override
  ConsumerState<TransactionEditor> createState() => _TransactionEditorState();
}

/// 表单只在页面存活期间保留，不提供本地持久化或离线队列。
class _TransactionEditorState extends ConsumerState<TransactionEditor> {
  /// 字段验证目标。
  final _form = GlobalKey<FormState>();

  /// 人民币元输入，不通过 double 回填。
  late final TextEditingController _amount;

  /// 可选标题。
  late final TextEditingController _title;

  /// 可选备注。
  late final TextEditingController _remark;

  /// 本条类型；编辑固定。
  late EntryType _type;

  /// 本地自然发生日期。
  late DateTime _date;

  /// 当前一级选择，用于支出两级录入。
  int? _primaryId;

  /// 实际绑定分类，支出必须是二级。
  int? _categoryId;

  /// 标签名称、原 ID 和改名的独立草稿。
  TagDrafts _tags = const TagDrafts();

  /// 查重读请求，退出时取消。
  final _tagCancel = CancelToken();

  /// 未保存变化标识。
  bool _dirty = false;

  /// 流水写入锁。
  bool _busy = false;

  /// 标签查重 / 编辑锁，避免期间提交流水。
  bool _tagBusy = false;

  /// 持续失败信息，输入保留。
  Object? _error;

  /// 从原有记录回填，保留原归档分类和标签。
  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(text: widget.item?.amount ?? '');
    _title = TextEditingController(text: widget.item?.title ?? '');
    _remark = TextEditingController(text: widget.item?.remark ?? '');
    _type = widget.item?.type ?? EntryType.expense;
    _date = widget.item == null
        ? DateTime.now()
        : parseNaturalDate(widget.item!.occurredDate);
    _primaryId = widget.item?.category.primary.id;
    _categoryId =
        widget.item?.category.secondary?.id ?? widget.item?.category.primary.id;
    _tags = TagDrafts([
      // [tag] 是原记录真实关联，归档项可保留或移除。
      for (final tag in widget.item?.tags ?? <Tag>[])
        TagDraft(name: tag.name, original: tag),
    ]);
  }

  /// 标记当前页面未保存改动；表单取消不会产生服务请求。
  void _changed() => setState(() => _dirty = true);

  /// 选择自然日期，允许今天之后的有效业务日期。
  Future<void> _pickDate() async {
    // 日期控件返回的本地年月日，不转 UTC。
    final date = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(1000),
      lastDate: DateTime(9999, 12, 31),
    );
    if (date != null && mounted) {
      setState(() {
        _date = date;
        _dirty = true;
      });
    }
  }

  /// 自由输入新标签；只有查重后明确确认才能复用已有真实 ID。
  Future<void> _addName() async {
    if (_tagBusy || _busy) {
      return;
    }
    // 弹窗只产生本地草稿名称。
    final name = await promptName(context, '添加新标签');
    if (name == null || !mounted) {
      return;
    }
    if (_tags.containsName(name)) {
      setState(() => _error = const ApiError('当前流水已添加该标签'));
      return;
    }
    setState(() {
      _tagBusy = true;
      _error = null;
    });
    try {
      // 同名检查是只读查询，不调用 POST /tags。
      final existing = await ref
          .read(repositoryProvider)
          .checkTag(name, _tagCancel);
      if (!mounted) {
        return;
      }
      if (existing != null) {
        if (_tags.containsId(existing.id)) {
          throw const ApiError('当前流水已添加该标签');
        }
        if (!await confirm(
              context,
              '已有同名标签',
              '是否复用“${existing.name}”？',
              action: '复用',
            ) ||
            !mounted) {
          return;
        }
      }
      setState(() {
        _tags = _tags.add(TagDraft(name: name, original: existing));
        _dirty = true;
      });
    } catch (error) {
      // [error] 保持原集合，后端并发查重最终仍由流水事务裁决。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _tagBusy = false);
      }
    }
  }

  /// 改名索引 [index] 的草稿；已有有效标签保留 ID，归档标签禁止改名。
  Future<void> _rename(int index) async {
    if (_busy || _tagBusy) {
      return;
    }
    // 原始草稿实体保持不变，确认后创建新的不可变集合。
    final draft = _tags.items[index];
    if (draft.original?.archived == true) {
      return;
    }
    // 本地候选名称；已有改名会影响其他历史记录，明确说明。
    final name = await promptName(
      context,
      '修改标签草稿',
      initial: draft.name,
      hint: draft.original != null ? '保存流水后，此改名会影响使用该标签的其他历史记录。' : null,
    );
    if (name == null || name == draft.name || !mounted) {
      return;
    }
    if (_tags.containsName(name)) {
      setState(() => _error = const ApiError('草稿中已有同名标签'));
      return;
    }
    setState(() {
      _tagBusy = true;
      _error = null;
    });
    try {
      // 改名查重不能静默把原 ID 替换为另一真实 ID。
      final existing = await ref
          .read(repositoryProvider)
          .checkTag(name, _tagCancel);
      if (!mounted) {
        return;
      }
      if (existing != null && existing.id != draft.original?.id) {
        throw const ApiError('该名称已被其他标签使用');
      }
      setState(() {
        _tags = _tags.rename(index, name);
        _dirty = true;
      });
    } catch (error) {
      // [error] 保留原名称和所有标签。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _tagBusy = false);
      }
    }
  }

  /// 完整校验后提交一次，只有服务端成功才离开；重查失败不会重新创建。
  Future<void> _save() async {
    if (_busy || _tagBusy || !_form.currentState!.validate()) {
      return;
    }
    if (_categoryId == null) {
      setState(() => _error = const ApiError('请选择有效分类，支出须选择二级'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // 编辑始终发送六个完整字段，null / [] 表示真正清空。
      final body = <String, dynamic>{
        if (widget.item == null) 'type': _type.name,
        'categoryId': _categoryId,
        'amount': _amount.text,
        'occurredDate': naturalDate(_date),
        'title': _title.text.trim().isEmpty ? null : _title.text.trim(),
        'remark': _remark.text.trim().isEmpty ? null : _remark.text.trim(),
        ..._tags.toBody(),
      };
      await ref
          .read(repositoryProvider)
          .save(
            widget.item == null
                ? '/transactions'
                : '/transactions/${widget.item?.id}',
            body,
            method: widget.item == null ? 'POST' : 'PATCH',
          );
      if (mounted) {
        setState(() {
          _dirty = false;
          _busy = false;
        });
        toast(context, '已保存；列表将重新查询，如刷新失败请重试查询');
        context.pop();
      }
    } catch (error) {
      // [error] 保存失败或结果不确定，当前输入不丢失，不自动重试写入。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 构建两级分类选择。[categories] 为有效树；原有归档项只可保留，不新绑定。
  Widget _categoryFields(List<Category> categories) {
    // 已选一级分类，刷新移除后不映射为其他主键。
    final parents = categories.where((category) => !category.archived).toList();
    // 当前选择的父类或 null，子类只能来自该父类。
    final parent = parents
        .where((category) => category.id == _primaryId)
        .firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.item != null)
          Text(
            '原分类：${widget.item?.category.primary.name}${widget.item?.category.secondary == null ? '' : ' / ${widget.item?.category.secondary?.name}'}'
            '${widget.item?.category.primary.archived == true || widget.item?.category.secondary?.archived == true ? '（已删除，可保留）' : ''}',
          ),
        DropdownButtonFormField<int>(
          key: ValueKey('$_type:$_primaryId'),
          initialValue: parent?.id,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: _type == EntryType.expense ? '一级分类' : '收入分类',
          ),
          items: [
            // [category] 有效一级，支出不能将该 ID 直接绑定流水。
            for (final category in parents)
              DropdownMenuItem(
                value: category.id,
                child: Text(category.name, overflow: TextOverflow.ellipsis),
              ),
          ],
          // [id] 为用户新选择的有效父类，方向变化会清理旧选择。
          onChanged: _busy
              ? null
              : (id) => setState(() {
                  _primaryId = id;
                  _categoryId = _type == EntryType.income ? id : null;
                  _dirty = true;
                }),
        ),
        if (_type == EntryType.expense && parent != null)
          DropdownButtonFormField<int>(
            key: ValueKey('$_primaryId:$_categoryId'),
            initialValue:
                parent.children.any(
                  (child) => child.id == _categoryId && !child.archived,
                )
                ? _categoryId
                : null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: '二级分类'),
            items: [
              // [child] 只能选有效二级，不允许父类作为流水 categoryId。
              for (final child in parent.children)
                if (!child.archived)
                  DropdownMenuItem(
                    value: child.id,
                    child: Text(child.name, overflow: TextOverflow.ellipsis),
                  ),
            ],
            // [id] 为实际二级绑定 ID。
            onChanged: _busy
                ? null
                : (id) => setState(() {
                    _categoryId = id;
                    _dirty = true;
                  }),
          ),
        if (parents.isEmpty ||
            (_type == EntryType.expense &&
                parent != null &&
                parent.children.isEmpty))
          TextButton(
            onPressed: _busy ? null : () => context.push('/account/categories'),
            child: const Text('没有可用分类，前往分类管理添加'),
          ),
      ],
    );
  }

  /// 释放 Controller 及查重请求，敏感页面草稿不持久化。
  @override
  void dispose() {
    _tagCancel.cancel();
    _amount.dispose();
    _title.dispose();
    _remark.dispose();
    super.dispose();
  }

  /// 构建手机录入页面。[context] 提供主题、键盘和导航。
  @override
  Widget build(BuildContext context) => DraftGuard(
    dirty: _dirty,
    busy: _busy || _tagBusy,
    child: Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => Navigator.of(context).maybePop()),
        title: Text(widget.item == null ? '记一笔' : '编辑流水'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _form,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<EntryType>(
                  segments: const [
                    ButtonSegment(value: EntryType.expense, label: Text('支出')),
                    ButtonSegment(value: EntryType.income, label: Text('收入')),
                  ],
                  selected: {_type},
                  // [selection] 创建时允许切换，编辑时 type 不进入 PATCH。
                  onSelectionChanged: widget.item != null || _busy
                      ? null
                      : (selection) => setState(() {
                          _type = selection.first;
                          _primaryId = null;
                          _categoryId = null;
                          _dirty = true;
                        }),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _amount,
                  enabled: !_busy,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: '金额（元）',
                    prefixText: '¥ ',
                  ),
                  validator: validateAmount,
                  // [text] 标记金额输入变化，业务校验不依赖软键盘。
                  onChanged: (text) => _changed(),
                ),
                const SizedBox(height: 16),
                QueryView(
                  value: ref.watch(
                    categoriesProvider((type: _type, archived: false)),
                  ),
                  retry: () => ref.invalidate(
                    categoriesProvider((type: _type, archived: false)),
                  ),
                  builder: _categoryFields,
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('发生日期'),
                  subtitle: Text(naturalDate(_date)),
                  trailing: const Icon(Icons.calendar_month_outlined),
                  onTap: _busy ? null : _pickDate,
                ),
                TextFormField(
                  controller: _title,
                  enabled: !_busy,
                  decoration: const InputDecoration(labelText: '标题（选填）'),
                  // [text] 按后端 Unicode 码点校验。
                  validator: (text) => validateText(text, 50),
                  onChanged: (text) => _changed(),
                ),
                const SizedBox(height: 20),
                const Text('标签'),
                Wrap(
                  spacing: 8,
                  children: [
                    // [i] 为草稿位置，删除仅解绑本流水。
                    for (var i = 0; i < _tags.items.length; i++)
                      InputChip(
                        label: Text(
                          '${_tags.items[i].name}${_tags.items[i].original?.archived == true ? '（已删除）' : ''}',
                        ),
                        onPressed:
                            _busy ||
                                _tagBusy ||
                                _tags.items[i].original?.archived == true
                            ? null
                            : () => _rename(i),
                        onDeleted: _busy || _tagBusy
                            ? null
                            : () => setState(() {
                                _tags = _tags.remove(i);
                                _dirty = true;
                              }),
                      ),
                  ],
                ),
                QueryView(
                  value: ref.watch(tagsProvider((key: '', archived: false))),
                  retry: () =>
                      ref.invalidate(tagsProvider((key: '', archived: false))),
                  // [tags] 为可新绑定的有效标签，不含其他归档项。
                  builder: (tags) => DropdownButtonFormField<int>(
                    key: ValueKey(_tags.items.length),
                    initialValue: null,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: '选择已有标签'),
                    items: [
                      // [tag] 按 ID 去重，已选项不重复显示。
                      for (final tag in tags)
                        if (!_tags.containsId(tag.id))
                          DropdownMenuItem(
                            value: tag.id,
                            child: Text(
                              tag.name,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                    ],
                    // [id] 必定来自当前有效列表，用原 ID 加入草稿。
                    onChanged: _busy || _tagBusy
                        ? null
                        : (id) {
                            if (id != null) {
                              // 用户选择的真实标签。
                              final tag = tags.firstWhere(
                                (tag) => tag.id == id,
                              );
                              setState(() {
                                _tags = _tags.add(
                                  TagDraft(name: tag.name, original: tag),
                                );
                                _dirty = true;
                              });
                            }
                          },
                  ),
                ),
                TextButton.icon(
                  onPressed: _busy || _tagBusy ? null : _addName,
                  icon: const Icon(Icons.add),
                  label: Text(_tagBusy ? '检查名称中…' : '输入新标签'),
                ),
                TextFormField(
                  controller: _remark,
                  enabled: !_busy,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: '备注（选填）'),
                  // [text] 对齐后端 100 码点上限。
                  validator: (text) => validateText(text, 100),
                  onChanged: (text) => _changed(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  ErrorNotice(error: _error!),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy || _tagBusy ? null : _save,
                  child: Text(_busy ? '保存中…' : '保存流水'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
