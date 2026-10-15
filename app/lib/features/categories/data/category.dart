import 'package:freezed_annotation/freezed_annotation.dart';

part 'category.freezed.dart';
part 'category.g.dart';

/// 收支方向，与接口字符串精确对应。
enum EntryType {
  /// 支出，流水实际绑定二级分类。
  expense,

  /// 收入，仅允许一级分类。
  income;

  /// 返回默认简体中文方向文案。
  String get label => this == expense ? '支出' : '收入';
}

/// 分类树、历史关联和汇总共用的不可变分类展示模型。
@freezed
abstract class Category with _$Category {
  /// [id] 为服务端主键；[name] 为名称；[iconKey] 为本地资源映射键；
  /// [backgroundColor] 为后端最终色；[archived] 标记历史关联；[type] 为方向；
  /// [level] 为层级；[parentId] 为二级父类；[sortOrder] 为接口顺序；
  /// [isDefault] 表示默认模板来源；[children] 为子类；[amount] 仅汇总时提供。
  const factory Category({
    /// 用户分类主键。
    required int id,

    /// 当前分类名称，历史归档仍保留。
    required String name,

    /// 本地 SVG 映射的 iconKey。
    required String iconKey,

    /// 后端计算的颜色，子类继承父级背景。
    required String backgroundColor,

    /// 历史关联是否已归档，部分接口省略时为 false。
    @Default(false) bool archived,

    /// 树接口收支方向，历史展示不提供时为空。
    EntryType? type,

    /// 树接口一级 / 二级；历史展示不提供时为空。
    int? level,

    /// 一级为空，二级指向所属父级。
    int? parentId,

    /// 按接口顺序展示，不在客户端重新排序。
    @Default(0) int sortOrder,

    /// 是否来自默认分类模板。
    @Default(false) bool isDefault,

    /// 一级分类树或月汇总中的二级项。
    @Default([]) List<Category> children,

    /// 月汇总分类金额，单位元。
    String? amount,
  }) = _Category;

  /// 从 [json] 解析分类；必要字段损坏会抛出解析错误。
  factory Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);
}

/// 服务端允许创建分类的图标选项。
@freezed
abstract class CategoryIconOption with _$CategoryIconOption {
  /// [iconKey] 为可提交键；[backgroundColor] 为该图标默认背景色。
  const factory CategoryIconOption({
    /// 允许提交的图标键。
    required String iconKey,

    /// 一级默认背景色。
    required String backgroundColor,
  }) = _CategoryIconOption;

  /// 从 [json] 读取图库，不凭本地文件虚构后端允许的图标。
  factory CategoryIconOption.fromJson(Map<String, dynamic> json) =>
      _$CategoryIconOptionFromJson(json);
}
