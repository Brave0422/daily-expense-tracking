import '../../tags/data/tag.dart';

/// 单个标签编辑草稿，已有标签保留原 ID，新标签没有虚构主键。
class TagDraft {
  /// [name] 为当前草稿名称；[original] 为真实标签或新建时 null。
  const TagDraft({required this.name, this.original});

  /// 当前未提交名称。
  final String name;

  /// 原实体与归档状态，不在编辑时更改服务端数据。
  final Tag? original;
}

/// 不可变标签集合的纯业务逻辑，草稿阶段没有写接口。
class TagDrafts {
  /// [items] 为已选标签的独立草稿，取消页面即丢弃。
  const TagDrafts([this.items = const []]);

  /// 当前顺序中的标签名称 / 原 ID。
  final List<TagDraft> items;

  /// [name] 是否已被当前草稿使用，按 trim 后完整名称比较。
  bool containsName(String name) =>
      items.any((item) => item.name == name.trim());

  /// [id] 是否已绑定，防止同一真实标签重复选中。
  bool containsId(int id) => items.any((item) => item.original?.id == id);

  /// 加入 [draft]，调用方必须先完成查重、确认复用及格式校验。
  TagDrafts add(TagDraft draft) =>
      TagDrafts(List.unmodifiable([...items, draft]));

  /// 删除索引 [index] 的草稿及其改名，不执行全局标签归档。
  TagDrafts remove(int index) => TagDrafts(
    List.unmodifiable([
      // [i] 为当前项位置，仅保留其他项。
      for (var i = 0; i < items.length; i++)
        if (i != index) items[i],
    ]),
  );

  /// 修改索引 [index] 的 [name]，保留真实 ID；新建项仍只是名称。
  TagDrafts rename(int index, String name) => TagDrafts(
    List.unmodifiable([
      // [i] 为草稿位置，原引用不会被修改。
      for (var i = 0; i < items.length; i++)
        i == index
            ? TagDraft(name: name.trim(), original: items[i].original)
            : items[i],
    ]),
  );

  /// 构造随流水一起提交的标签集合和改名，移除的草稿不会产生 tagUpdates。
  Map<String, dynamic> toBody() => {
    'tagIds': [
      // [item] 为真实关联，保留原有归档 ID 的权限由后端裁决。
      for (final item in items)
        if (item.original != null) item.original!.id,
    ],
    if (items.any((item) => item.original == null))
      'tagNames': [
        // [item] 无主键时只是本次流水的新建名称。
        for (final item in items)
          if (item.original == null) item.name,
      ],
    if (items.any(
      (item) => item.original != null && item.name != item.original!.name,
    ))
      'tagUpdates': [
        // [item] 已有标签改名，ID 必定仍存在于上方 tagIds。
        for (final item in items)
          if (item.original != null && item.name != item.original!.name)
            {'id': item.original!.id, 'name': item.name},
      ],
  };
}
