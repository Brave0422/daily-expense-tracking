import 'package:freezed_annotation/freezed_annotation.dart';

part 'tag.freezed.dart';
part 'tag.g.dart';

/// 标签真实实体，名称相同不意味着 ID 相同。
@freezed
abstract class Tag with _$Tag {
  /// [id] 为真实主键；[name] 为名称；[archived] 省略时表示有效标签。
  const factory Tag({
    /// 当前用户标签主键。
    required int id,

    /// 展示或回填的标签名称。
    required String name,

    /// 原关联已归档时只允许保留或移除。
    @Default(false) bool archived,
  }) = _Tag;

  /// 从 [json] 读取标签，拒绝损坏主键和名称。
  factory Tag.fromJson(Map<String, dynamic> json) => _$TagFromJson(json);
}
