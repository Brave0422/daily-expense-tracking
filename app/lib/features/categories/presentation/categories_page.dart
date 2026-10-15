import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/category_icon.dart';
import '../../../core/widgets/common.dart';
import '../data/category.dart';

/// 分类配置管理，操作立即写入服务端。
class CategoriesPage extends ConsumerStatefulWidget {
  /// [key] 标识当前账号的管理页面。
  const CategoriesPage({super.key});

  /// 创建方向、提交锁和持续错误状态。
  @override
  ConsumerState<CategoriesPage> createState() => _CategoriesPageState();
}

/// 分类树操作的页面状态。
class _CategoriesPageState extends ConsumerState<CategoriesPage> {
  /// 当前管理方向，收入不展示二级操作。
  EntryType _type = EntryType.expense;

  /// 删除动作锁，防止重复请求。
  bool _busy = false;

  /// 保留服务端拒绝和网络错误。
  Object? _error;

  /// 打开编辑面板。[category] 编辑已有项；[parent] 创建支出二级的真实父类。
  Future<void> _edit({Category? category, Category? parent}) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      isDismissible: false,
      enableDrag: false,
      // [context] 为面板上下文，不在管理页保存表单 Controller。
      builder: (context) =>
          CategoryEditor(type: _type, category: category, parent: parent),
    );
  }

  /// 删除 [category]；一级仍有有效子类时明确阻止，不做自动级联。
  Future<void> _delete(Category category) async {
    if (_busy) {
      return;
    }
    if (category.children.any((child) => !child.archived)) {
      setState(() => _error = const ApiError('请先删除该一级分类下的二级分类'));
      return;
    }
    if (!await confirm(
          context,
          '删除“${category.name}”？',
          '历史流水会保留分类关联；统计将排除此分类关联金额。',
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
          .save('/categories/${category.id}/archive', null, method: 'DELETE');
      if (mounted) {
        toast(context, '分类已删除');
      }
    } catch (error) {
      // [error] 保留上下文，不在请求前乐观移除分类。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 构建 [category] 的独立操作菜单，点击删除不触发行编辑。
  Widget _actions(Category category) => PopupMenuButton<String>(
    enabled: !_busy,
    tooltip: '${category.name}操作',
    // [action] 为用户明确选择的修改或删除动作。
    onSelected: (action) =>
        action == 'edit' ? _edit(category: category) : _delete(category),
    // [context] 为弹出菜单上下文。
    itemBuilder: (context) => const [
      PopupMenuItem(value: 'edit', child: Text('编辑')),
      PopupMenuItem(value: 'delete', child: Text('删除')),
    ],
  );

  /// 构建手机端树与方向切换。[context] 提供主题。
  @override
  Widget build(BuildContext context) {
    // 管理仅查询有效项，历史关联由流水页面独立查询。
    final provider = categoriesProvider((type: _type, archived: false));
    return Scaffold(
      appBar: AppBar(title: const Text('分类管理')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : () => _edit(),
        icon: const Icon(Icons.add),
        label: Text('添加${_type.label}一级分类'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SegmentedButton<EntryType>(
              segments: const [
                ButtonSegment(value: EntryType.expense, label: Text('支出')),
                ButtonSegment(value: EntryType.income, label: Text('收入')),
              ],
              selected: {_type},
              // [selection] 包含单个方向，切换后查询对应树。
              onSelectionChanged: _busy
                  ? null
                  : (selection) => setState(() {
                      _type = selection.first;
                      _error = null;
                    }),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: ErrorNotice(error: _error!),
            ),
          Expanded(
            child: QueryView(
              value: ref.watch(provider),
              retry: () => ref.invalidate(provider),
              // [categories] 为后端有序分类树。
              builder: (categories) => categories.isEmpty
                  ? const Center(child: Text('暂无分类，请添加'))
                  : ListView.builder(
                      padding: const EdgeInsets.only(bottom: 100),
                      itemCount: categories.length,
                      // [context] 提供主题；[index] 为服务端顺序索引。
                      itemBuilder: (context, index) {
                        // 当前一级分类及其子类。
                        final category = categories[index];
                        return ExpansionTile(
                          key: ValueKey(category.id),
                          leading: CategoryIcon(
                            iconKey: category.iconKey,
                            color: category.backgroundColor,
                          ),
                          title: Text(category.name),
                          trailing: _actions(category),
                          children: [
                            // [child] 为真实二级项，收入不会提供添加二级入口。
                            for (final child in category.children)
                              ListTile(
                                contentPadding: const EdgeInsets.only(
                                  left: 48,
                                  right: 16,
                                ),
                                leading: CategoryIcon(
                                  iconKey: child.iconKey,
                                  color: child.backgroundColor,
                                  size: 32,
                                ),
                                title: Text(child.name),
                                trailing: _actions(child),
                              ),
                            if (_type == EntryType.expense)
                              TextButton.icon(
                                onPressed: _busy
                                    ? null
                                    : () => _edit(parent: category),
                                icon: const Icon(Icons.add),
                                label: const Text('添加二级分类'),
                              ),
                          ],
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 分类创建 / 编辑面板，类型与父类固定且不提供颜色编辑。
class CategoryEditor extends ConsumerStatefulWidget {
  /// [type] 为方向；[category] 为原分类；[parent] 仅创建二级使用；[key] 为标识。
  const CategoryEditor({
    super.key,
    required this.type,
    this.category,
    this.parent,
  });

  /// 创建方向，编辑不可修改。
  final EntryType type;

  /// 原有分类，不在取消时修改。
  final Category? category;

  /// 新二级的有效一级父类。
  final Category? parent;

  /// 创建当前表单草稿。
  @override
  ConsumerState<CategoryEditor> createState() => _CategoryEditorState();
}

/// 分类表单生命周期和写入锁。
class _CategoryEditorState extends ConsumerState<CategoryEditor> {
  /// 字段校验目标。
  final _form = GlobalKey<FormState>();

  /// 名称输入，退出后释放。
  late final TextEditingController _name;

  /// 已选择的真实图库键。
  String? _iconKey;

  /// 表单是否已修改。
  bool _dirty = false;

  /// 保存锁。
  bool _busy = false;

  /// 失败持续信息。
  Object? _error;

  /// 从原分类独立回填，不更改列表实体。
  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.category?.name ?? '');
    _iconKey = widget.category?.iconKey;
  }

  /// 按当前图库校验再保存，成功后跨模块查询失效。
  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) {
      return;
    }
    // 已解析图标列表；加载失败或空列表不能提交任意 iconKey。
    final icons = ref.read(iconsProvider).asData?.value ?? [];
    if (!icons.any((icon) => icon.iconKey == _iconKey)) {
      setState(() => _error = const ApiError('请从已加载图库选择图标'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(repositoryProvider).save(
        widget.category == null ? '/categories/create' : '/categories/update',
        {
          'name': _name.text.trim(),
          'iconKey': _iconKey,
          if (widget.category != null) 'id': widget.category?.id,
          if (widget.category == null) 'type': widget.type.name,
          if (widget.category == null && widget.parent != null)
            'parentId': widget.parent?.id,
        },
      );
      if (mounted) {
        setState(() {
          _dirty = false;
          _busy = false;
        });
        toast(context, '分类已保存');
        Navigator.pop(context);
      }
    } catch (error) {
      // [error] 为同父级重名或网络失败，保留名称和图标。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 释放名称输入。
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  /// 构建图库网格及预览。[context] 提供主题、键盘和安全区域。
  @override
  Widget build(BuildContext context) => DraftGuard(
    dirty: _dirty,
    busy: _busy,
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.category == null
                          ? '添加${widget.parent == null ? '一级' : '二级'}分类'
                          : '编辑分类',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: '关闭分类表单',
                    onPressed: _busy
                        ? null
                        : () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              if (widget.parent != null) Text('父分类：${widget.parent?.name}'),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                enabled: !_busy,
                decoration: const InputDecoration(labelText: '分类名称'),
                // [text] 与后端 trim / 50 码点校验一致。
                validator: (text) => validateText(text, 50, required: true),
                // [text] 标记未保存改动，不提前请求。
                onChanged: (text) => setState(() => _dirty = true),
              ),
              const SizedBox(height: 16),
              QueryView(
                value: ref.watch(iconsProvider),
                retry: () => ref.invalidate(iconsProvider),
                // [icons] 只使用服务端允许的图标。
                builder: (icons) => icons.isEmpty
                    ? const Text('图库为空，请重试')
                    : SizedBox(
                        height: 240,
                        child: GridView.builder(
                          gridDelegate:
                              const SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 64,
                              ),
                          itemCount: icons.length,
                          // [context] 为网格主题；[index] 为图库索引。
                          itemBuilder: (context, index) {
                            // 当前允许的图标项。
                            final icon = icons[index];
                            return IconButton(
                              tooltip: '选择图标${index + 1}',
                              isSelected: _iconKey == icon.iconKey,
                              style: IconButton.styleFrom(
                                backgroundColor: _iconKey == icon.iconKey
                                    ? Theme.of(context)
                                          .colorScheme
                                          .primaryContainer
                                    : null,
                              ),
                              onPressed: _busy
                                  ? null
                                  : () => setState(() {
                                      _iconKey = icon.iconKey;
                                      _dirty = true;
                                    }),
                              icon: CategoryIcon(
                                iconKey: icon.iconKey,
                                color:
                                    widget.parent?.backgroundColor ??
                                    icon.backgroundColor,
                              ),
                            );
                          },
                        ),
                      ),
              ),
              if (_error != null) ErrorNotice(error: _error!),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(_busy ? '保存中…' : '保存分类'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
