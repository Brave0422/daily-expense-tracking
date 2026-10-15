import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/utils/values.dart';
import '../../../core/widgets/common.dart';
import '../data/tag.dart';

/// 标签配置模式，确认创建 / 改名时立即写入，不与流水草稿混用。
class TagsPage extends ConsumerStatefulWidget {
  /// [key] 为当前管理页面标识。
  const TagsPage({super.key});

  /// 创建搜索与动作状态。
  @override
  ConsumerState<TagsPage> createState() => _TagsPageState();
}

/// 管理搜索去抖及写入边界。
class _TagsPageState extends ConsumerState<TagsPage> {
  /// 实際搜索关键词，保留在增删改后的重查中。
  String _key = '';

  /// 搜索输入控制器。
  final _search = TextEditingController();

  /// 300ms 去抖，页面关闭后释放。
  Timer? _debounce;

  /// 删除提交锁。
  bool _busy = false;

  /// 搜索校验或删除失败信息。
  Object? _error;

  /// 对 [text] 去抖后请求服务器搜索，空关键词请求完整列表。
  void _searchChanged(String text) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (validateText(text, 50) != null) {
        setState(() => _error = '关键词最多50个字符');
      } else {
        setState(() {
          _key = text.trim();
          _error = null;
        });
      }
    });
  }

  /// 打开配置编辑。[tag] 为空创建，否则按原 ID 改名。
  Future<void> _edit([Tag? tag]) async => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: false,
    enableDrag: false,
    // [context] 为表单面板上下文。
    builder: (context) => TagEditor(tag: tag),
  );

  /// 删除 [tag]，保留历史关联，不调用流水删除接口。
  Future<void> _delete(Tag tag) async {
    if (_busy ||
        !await confirm(
          context,
          '删除“${tag.name}”？',
          '历史流水保留此标签关联。',
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
          .save('/tags/${tag.id}/archive', null, method: 'DELETE');
      if (mounted) {
        toast(context, '标签已删除');
      }
    } catch (error) {
      // [error] 保留当前搜索及列表上下文。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 释放去抖和控制器，Provider 同时取消旧请求。
  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  /// 构建真实服务器搜索结果。[context] 为页面主题。
  @override
  Widget build(BuildContext context) {
    // 搜索条件标识，每次变化使用新的可取消查询。
    final provider = tagsProvider((key: _key, archived: false));
    return Scaffold(
      appBar: AppBar(title: const Text('标签管理')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : () => _edit(),
        icon: const Icon(Icons.add),
        label: const Text('添加标签'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _search,
              decoration: const InputDecoration(
                labelText: '搜索标签',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: _searchChanged,
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
              // [tags] 是完整的后端搜索结果，禁止只过滤已有部分本地列表。
              builder: (tags) => tags.isEmpty
                  ? Center(child: Text(_key.isEmpty ? '暂无标签' : '没有匹配标签'))
                  : ListView.builder(
                      padding: const EdgeInsets.only(bottom: 100),
                      itemCount: tags.length,
                      // [context] 为行上下文；[index] 为服务端顺序。
                      itemBuilder: (context, index) => ListTile(
                        leading: const Icon(Icons.sell_outlined),
                        title: Text(tags[index].name),
                        trailing: PopupMenuButton<String>(
                          enabled: !_busy,
                          tooltip: '标签操作',
                          // [action] 为明确选择的改名或删除。
                          onSelected: (action) => action == 'edit'
                              ? _edit(tags[index])
                              : _delete(tags[index]),
                          // [context] 为菜单上下文。
                          itemBuilder: (context) => const [
                            PopupMenuItem(value: 'edit', child: Text('改名')),
                            PopupMenuItem(value: 'delete', child: Text('删除')),
                          ],
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 配置模式标签表单，不用于流水内的本地草稿。
class TagEditor extends ConsumerStatefulWidget {
  /// [tag] 为改名目标或 null 创建；[key] 为标识。
  const TagEditor({super.key, this.tag});

  /// 按 ID 保持历史关联的目标标签。
  final Tag? tag;

  /// 创建本地表单状态。
  @override
  ConsumerState<TagEditor> createState() => _TagEditorState();
}

/// 标签写入锁和未保存状态。
class _TagEditorState extends ConsumerState<TagEditor> {
  /// 校验当前名称。
  final _form = GlobalKey<FormState>();

  /// 输入控制器，取消后销毁。
  late final TextEditingController _name;

  /// 表单是否修改。
  bool _dirty = false;

  /// 单次写入锁。
  bool _busy = false;

  /// 后端重名等错误。
  Object? _error;

  /// 初始化原名称的独立草稿。
  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.tag?.name ?? '');
  }

  /// 按原 ID 创建或改名，成功后通知流水选项 / 历史关联重查。
  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(repositoryProvider).save(
        widget.tag == null ? '/tags' : '/tags/${widget.tag?.id}',
        {'name': _name.text.trim()},
        method: widget.tag == null ? 'POST' : 'PATCH',
      );
      if (mounted) {
        setState(() {
          _dirty = false;
          _busy = false;
        });
        toast(context, '标签已保存');
        Navigator.pop(context);
      }
    } catch (error) {
      // [error] 保留输入，不能把重名静默合并为其他 ID。
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// 释放名称控制器。
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  /// 构建配置表单与影响范围说明。[context] 提供键盘边距。
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
                      widget.tag == null ? '添加标签' : '标签改名',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: '关闭标签表单',
                    onPressed: _busy
                        ? null
                        : () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              if (widget.tag != null) const Text('改名会影响使用此标签的其他历史记录。'),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                enabled: !_busy,
                decoration: const InputDecoration(labelText: '标签名称'),
                // [text] 为名称，按 Unicode 码点限制 50 字符。
                validator: (text) => validateText(text, 50, required: true),
                // [text] 仅标记草稿变化。
                onChanged: (text) => setState(() => _dirty = true),
              ),
              if (_error != null) ErrorNotice(error: _error!),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(_busy ? '保存中…' : '保存标签'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
