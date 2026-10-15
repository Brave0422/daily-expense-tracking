// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'category.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Category {

/// 用户分类主键。
 int get id;/// 当前分类名称，历史归档仍保留。
 String get name;/// 本地 SVG 映射的 iconKey。
 String get iconKey;/// 后端计算的颜色，子类继承父级背景。
 String get backgroundColor;/// 历史关联是否已归档，部分接口省略时为 false。
 bool get archived;/// 树接口收支方向，历史展示不提供时为空。
 EntryType? get type;/// 树接口一级 / 二级；历史展示不提供时为空。
 int? get level;/// 一级为空，二级指向所属父级。
 int? get parentId;/// 按接口顺序展示，不在客户端重新排序。
 int get sortOrder;/// 是否来自默认分类模板。
 bool get isDefault;/// 一级分类树或月汇总中的二级项。
 List<Category> get children;/// 月汇总分类金额，单位元。
 String? get amount;
/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CategoryCopyWith<Category> get copyWith => _$CategoryCopyWithImpl<Category>(this as Category, _$identity);

  /// Serializes this Category to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Category;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Category&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.iconKey, _this.iconKey) || other.iconKey == _this.iconKey)&&(identical(other.backgroundColor, _this.backgroundColor) || other.backgroundColor == _this.backgroundColor)&&(identical(other.archived, _this.archived) || other.archived == _this.archived)&&(identical(other.type, _this.type) || other.type == _this.type)&&(identical(other.level, _this.level) || other.level == _this.level)&&(identical(other.parentId, _this.parentId) || other.parentId == _this.parentId)&&(identical(other.sortOrder, _this.sortOrder) || other.sortOrder == _this.sortOrder)&&(identical(other.isDefault, _this.isDefault) || other.isDefault == _this.isDefault)&&const DeepCollectionEquality().equals(other.children, _this.children)&&(identical(other.amount, _this.amount) || other.amount == _this.amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Category;
  return Object.hash(runtimeType,_this.id,_this.name,_this.iconKey,_this.backgroundColor,_this.archived,_this.type,_this.level,_this.parentId,_this.sortOrder,_this.isDefault,const DeepCollectionEquality().hash(_this.children),_this.amount);
}

@override
String toString() {
  final _this = this as Category;
  return 'Category(id: ${_this.id}, name: ${_this.name}, iconKey: ${_this.iconKey}, backgroundColor: ${_this.backgroundColor}, archived: ${_this.archived}, type: ${_this.type}, level: ${_this.level}, parentId: ${_this.parentId}, sortOrder: ${_this.sortOrder}, isDefault: ${_this.isDefault}, children: ${_this.children}, amount: ${_this.amount})';
}


}

/// @nodoc
abstract mixin class $CategoryCopyWith<$Res>  {
  factory $CategoryCopyWith(Category value, $Res Function(Category) _then) = _$CategoryCopyWithImpl;
@useResult
$Res call({
 int id, String name, String iconKey, String backgroundColor, bool archived, EntryType? type, int? level, int? parentId, int sortOrder, bool isDefault, List<Category> children, String? amount
});




}
/// @nodoc
class _$CategoryCopyWithImpl<$Res>
    implements $CategoryCopyWith<$Res> {
  _$CategoryCopyWithImpl(this._self, this._then);

  final Category _self;
  final $Res Function(Category) _then;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? iconKey = null,Object? backgroundColor = null,Object? archived = null,Object? type = freezed,Object? level = freezed,Object? parentId = freezed,Object? sortOrder = null,Object? isDefault = null,Object? children = null,Object? amount = freezed,}) {
  return _then(Category(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,iconKey: null == iconKey ? _self.iconKey : iconKey // ignore: cast_nullable_to_non_nullable
as String,backgroundColor: null == backgroundColor ? _self.backgroundColor : backgroundColor // ignore: cast_nullable_to_non_nullable
as String,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType?,level: freezed == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as int?,parentId: freezed == parentId ? _self.parentId : parentId // ignore: cast_nullable_to_non_nullable
as int?,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,isDefault: null == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool,children: null == children ? _self.children : children // ignore: cast_nullable_to_non_nullable
as List<Category>,amount: freezed == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [Category].
extension CategoryPatterns on Category {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Category value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Category value)  $default,){
final _that = this;
switch (_that) {
case _Category():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Category value)?  $default,){
final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String name,  String iconKey,  String backgroundColor,  bool archived,  EntryType? type,  int? level,  int? parentId,  int sortOrder,  bool isDefault,  List<Category> children,  String? amount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that.id,_that.name,_that.iconKey,_that.backgroundColor,_that.archived,_that.type,_that.level,_that.parentId,_that.sortOrder,_that.isDefault,_that.children,_that.amount);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String name,  String iconKey,  String backgroundColor,  bool archived,  EntryType? type,  int? level,  int? parentId,  int sortOrder,  bool isDefault,  List<Category> children,  String? amount)  $default,) {final _that = this;
switch (_that) {
case _Category():
return $default(_that.id,_that.name,_that.iconKey,_that.backgroundColor,_that.archived,_that.type,_that.level,_that.parentId,_that.sortOrder,_that.isDefault,_that.children,_that.amount);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String name,  String iconKey,  String backgroundColor,  bool archived,  EntryType? type,  int? level,  int? parentId,  int sortOrder,  bool isDefault,  List<Category> children,  String? amount)?  $default,) {final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that.id,_that.name,_that.iconKey,_that.backgroundColor,_that.archived,_that.type,_that.level,_that.parentId,_that.sortOrder,_that.isDefault,_that.children,_that.amount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Category implements Category {
  const _Category({required this.id, required this.name, required this.iconKey, required this.backgroundColor, this.archived = false, this.type, this.level, this.parentId, this.sortOrder = 0, this.isDefault = false,  List<Category> children = const [], this.amount}): _children = children;
  factory _Category.fromJson(Map<String, dynamic> json) => _$CategoryFromJson(json);

/// 用户分类主键。
@override final  int id;
/// 当前分类名称，历史归档仍保留。
@override final  String name;
/// 本地 SVG 映射的 iconKey。
@override final  String iconKey;
/// 后端计算的颜色，子类继承父级背景。
@override final  String backgroundColor;
/// 历史关联是否已归档，部分接口省略时为 false。
@override@JsonKey() final  bool archived;
/// 树接口收支方向，历史展示不提供时为空。
@override final  EntryType? type;
/// 树接口一级 / 二级；历史展示不提供时为空。
@override final  int? level;
/// 一级为空，二级指向所属父级。
@override final  int? parentId;
/// 按接口顺序展示，不在客户端重新排序。
@override@JsonKey() final  int sortOrder;
/// 是否来自默认分类模板。
@override@JsonKey() final  bool isDefault;
/// 一级分类树或月汇总中的二级项。
 final  List<Category> _children;
/// 一级分类树或月汇总中的二级项。
@override@JsonKey() List<Category> get children {
  if (_children is EqualUnmodifiableListView) return _children;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_children);
}

/// 月汇总分类金额，单位元。
@override final  String? amount;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CategoryCopyWith<_Category> get copyWith => __$CategoryCopyWithImpl<_Category>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CategoryToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Category&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.iconKey, iconKey) || other.iconKey == iconKey)&&(identical(other.backgroundColor, backgroundColor) || other.backgroundColor == backgroundColor)&&(identical(other.archived, archived) || other.archived == archived)&&(identical(other.type, type) || other.type == type)&&(identical(other.level, level) || other.level == level)&&(identical(other.parentId, parentId) || other.parentId == parentId)&&(identical(other.sortOrder, sortOrder) || other.sortOrder == sortOrder)&&(identical(other.isDefault, isDefault) || other.isDefault == isDefault)&&const DeepCollectionEquality().equals(other.children, _children)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,name,iconKey,backgroundColor,archived,type,level,parentId,sortOrder,isDefault,const DeepCollectionEquality().hash(_children),amount);
}

@override
String toString() {
    return 'Category(id: $id, name: $name, iconKey: $iconKey, backgroundColor: $backgroundColor, archived: $archived, type: $type, level: $level, parentId: $parentId, sortOrder: $sortOrder, isDefault: $isDefault, children: $children, amount: $amount)';
}


}

/// @nodoc
abstract mixin class _$CategoryCopyWith<$Res> implements $CategoryCopyWith<$Res> {
  factory _$CategoryCopyWith(_Category value, $Res Function(_Category) _then) = __$CategoryCopyWithImpl;
@override @useResult
$Res call({
 int id, String name, String iconKey, String backgroundColor, bool archived, EntryType? type, int? level, int? parentId, int sortOrder, bool isDefault, List<Category> children, String? amount
});




}
/// @nodoc
class __$CategoryCopyWithImpl<$Res>
    implements _$CategoryCopyWith<$Res> {
  __$CategoryCopyWithImpl(this._self, this._then);

  final _Category _self;
  final $Res Function(_Category) _then;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? iconKey = null,Object? backgroundColor = null,Object? archived = null,Object? type = freezed,Object? level = freezed,Object? parentId = freezed,Object? sortOrder = null,Object? isDefault = null,Object? children = null,Object? amount = freezed,}) {
  return _then(_Category(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,iconKey: null == iconKey ? _self.iconKey : iconKey // ignore: cast_nullable_to_non_nullable
as String,backgroundColor: null == backgroundColor ? _self.backgroundColor : backgroundColor // ignore: cast_nullable_to_non_nullable
as String,archived: null == archived ? _self.archived : archived // ignore: cast_nullable_to_non_nullable
as bool,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType?,level: freezed == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as int?,parentId: freezed == parentId ? _self.parentId : parentId // ignore: cast_nullable_to_non_nullable
as int?,sortOrder: null == sortOrder ? _self.sortOrder : sortOrder // ignore: cast_nullable_to_non_nullable
as int,isDefault: null == isDefault ? _self.isDefault : isDefault // ignore: cast_nullable_to_non_nullable
as bool,children: null == children ? _self._children : children // ignore: cast_nullable_to_non_nullable
as List<Category>,amount: freezed == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CategoryIconOption {

/// 允许提交的图标键。
 String get iconKey;/// 一级默认背景色。
 String get backgroundColor;
/// Create a copy of CategoryIconOption
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CategoryIconOptionCopyWith<CategoryIconOption> get copyWith => _$CategoryIconOptionCopyWithImpl<CategoryIconOption>(this as CategoryIconOption, _$identity);

  /// Serializes this CategoryIconOption to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as CategoryIconOption;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CategoryIconOption&&(identical(other.iconKey, _this.iconKey) || other.iconKey == _this.iconKey)&&(identical(other.backgroundColor, _this.backgroundColor) || other.backgroundColor == _this.backgroundColor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as CategoryIconOption;
  return Object.hash(runtimeType,_this.iconKey,_this.backgroundColor);
}

@override
String toString() {
  final _this = this as CategoryIconOption;
  return 'CategoryIconOption(iconKey: ${_this.iconKey}, backgroundColor: ${_this.backgroundColor})';
}


}

/// @nodoc
abstract mixin class $CategoryIconOptionCopyWith<$Res>  {
  factory $CategoryIconOptionCopyWith(CategoryIconOption value, $Res Function(CategoryIconOption) _then) = _$CategoryIconOptionCopyWithImpl;
@useResult
$Res call({
 String iconKey, String backgroundColor
});




}
/// @nodoc
class _$CategoryIconOptionCopyWithImpl<$Res>
    implements $CategoryIconOptionCopyWith<$Res> {
  _$CategoryIconOptionCopyWithImpl(this._self, this._then);

  final CategoryIconOption _self;
  final $Res Function(CategoryIconOption) _then;

/// Create a copy of CategoryIconOption
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? iconKey = null,Object? backgroundColor = null,}) {
  return _then(CategoryIconOption(
iconKey: null == iconKey ? _self.iconKey : iconKey // ignore: cast_nullable_to_non_nullable
as String,backgroundColor: null == backgroundColor ? _self.backgroundColor : backgroundColor // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CategoryIconOption].
extension CategoryIconOptionPatterns on CategoryIconOption {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CategoryIconOption value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CategoryIconOption() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CategoryIconOption value)  $default,){
final _that = this;
switch (_that) {
case _CategoryIconOption():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CategoryIconOption value)?  $default,){
final _that = this;
switch (_that) {
case _CategoryIconOption() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String iconKey,  String backgroundColor)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CategoryIconOption() when $default != null:
return $default(_that.iconKey,_that.backgroundColor);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String iconKey,  String backgroundColor)  $default,) {final _that = this;
switch (_that) {
case _CategoryIconOption():
return $default(_that.iconKey,_that.backgroundColor);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String iconKey,  String backgroundColor)?  $default,) {final _that = this;
switch (_that) {
case _CategoryIconOption() when $default != null:
return $default(_that.iconKey,_that.backgroundColor);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CategoryIconOption implements CategoryIconOption {
  const _CategoryIconOption({required this.iconKey, required this.backgroundColor});
  factory _CategoryIconOption.fromJson(Map<String, dynamic> json) => _$CategoryIconOptionFromJson(json);

/// 允许提交的图标键。
@override final  String iconKey;
/// 一级默认背景色。
@override final  String backgroundColor;

/// Create a copy of CategoryIconOption
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CategoryIconOptionCopyWith<_CategoryIconOption> get copyWith => __$CategoryIconOptionCopyWithImpl<_CategoryIconOption>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CategoryIconOptionToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _CategoryIconOption&&(identical(other.iconKey, iconKey) || other.iconKey == iconKey)&&(identical(other.backgroundColor, backgroundColor) || other.backgroundColor == backgroundColor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,iconKey,backgroundColor);
}

@override
String toString() {
    return 'CategoryIconOption(iconKey: $iconKey, backgroundColor: $backgroundColor)';
}


}

/// @nodoc
abstract mixin class _$CategoryIconOptionCopyWith<$Res> implements $CategoryIconOptionCopyWith<$Res> {
  factory _$CategoryIconOptionCopyWith(_CategoryIconOption value, $Res Function(_CategoryIconOption) _then) = __$CategoryIconOptionCopyWithImpl;
@override @useResult
$Res call({
 String iconKey, String backgroundColor
});




}
/// @nodoc
class __$CategoryIconOptionCopyWithImpl<$Res>
    implements _$CategoryIconOptionCopyWith<$Res> {
  __$CategoryIconOptionCopyWithImpl(this._self, this._then);

  final _CategoryIconOption _self;
  final $Res Function(_CategoryIconOption) _then;

/// Create a copy of CategoryIconOption
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? iconKey = null,Object? backgroundColor = null,}) {
  return _then(_CategoryIconOption(
iconKey: null == iconKey ? _self.iconKey : iconKey // ignore: cast_nullable_to_non_nullable
as String,backgroundColor: null == backgroundColor ? _self.backgroundColor : backgroundColor // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
