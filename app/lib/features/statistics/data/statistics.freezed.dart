// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'statistics.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$StatisticsParent {

/// 父分类真实主键。
 int get categoryId;/// 父分类当前名称。
 String get name;
/// Create a copy of StatisticsParent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StatisticsParentCopyWith<StatisticsParent> get copyWith => _$StatisticsParentCopyWithImpl<StatisticsParent>(this as StatisticsParent, _$identity);

  /// Serializes this StatisticsParent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as StatisticsParent;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StatisticsParent&&(identical(other.categoryId, _this.categoryId) || other.categoryId == _this.categoryId)&&(identical(other.name, _this.name) || other.name == _this.name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as StatisticsParent;
  return Object.hash(runtimeType,_this.categoryId,_this.name);
}

@override
String toString() {
  final _this = this as StatisticsParent;
  return 'StatisticsParent(categoryId: ${_this.categoryId}, name: ${_this.name})';
}


}

/// @nodoc
abstract mixin class $StatisticsParentCopyWith<$Res>  {
  factory $StatisticsParentCopyWith(StatisticsParent value, $Res Function(StatisticsParent) _then) = _$StatisticsParentCopyWithImpl;
@useResult
$Res call({
 int categoryId, String name
});




}
/// @nodoc
class _$StatisticsParentCopyWithImpl<$Res>
    implements $StatisticsParentCopyWith<$Res> {
  _$StatisticsParentCopyWithImpl(this._self, this._then);

  final StatisticsParent _self;
  final $Res Function(StatisticsParent) _then;

/// Create a copy of StatisticsParent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? categoryId = null,Object? name = null,}) {
  return _then(StatisticsParent(
categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [StatisticsParent].
extension StatisticsParentPatterns on StatisticsParent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StatisticsParent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StatisticsParent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StatisticsParent value)  $default,){
final _that = this;
switch (_that) {
case _StatisticsParent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StatisticsParent value)?  $default,){
final _that = this;
switch (_that) {
case _StatisticsParent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int categoryId,  String name)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StatisticsParent() when $default != null:
return $default(_that.categoryId,_that.name);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int categoryId,  String name)  $default,) {final _that = this;
switch (_that) {
case _StatisticsParent():
return $default(_that.categoryId,_that.name);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int categoryId,  String name)?  $default,) {final _that = this;
switch (_that) {
case _StatisticsParent() when $default != null:
return $default(_that.categoryId,_that.name);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StatisticsParent implements StatisticsParent {
  const _StatisticsParent({required this.categoryId, required this.name});
  factory _StatisticsParent.fromJson(Map<String, dynamic> json) => _$StatisticsParentFromJson(json);

/// 父分类真实主键。
@override final  int categoryId;
/// 父分类当前名称。
@override final  String name;

/// Create a copy of StatisticsParent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StatisticsParentCopyWith<_StatisticsParent> get copyWith => __$StatisticsParentCopyWithImpl<_StatisticsParent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StatisticsParentToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _StatisticsParent&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,categoryId,name);
}

@override
String toString() {
    return 'StatisticsParent(categoryId: $categoryId, name: $name)';
}


}

/// @nodoc
abstract mixin class _$StatisticsParentCopyWith<$Res> implements $StatisticsParentCopyWith<$Res> {
  factory _$StatisticsParentCopyWith(_StatisticsParent value, $Res Function(_StatisticsParent) _then) = __$StatisticsParentCopyWithImpl;
@override @useResult
$Res call({
 int categoryId, String name
});




}
/// @nodoc
class __$StatisticsParentCopyWithImpl<$Res>
    implements _$StatisticsParentCopyWith<$Res> {
  __$StatisticsParentCopyWithImpl(this._self, this._then);

  final _StatisticsParent _self;
  final $Res Function(_StatisticsParent) _then;

/// Create a copy of StatisticsParent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? categoryId = null,Object? name = null,}) {
  return _then(_StatisticsParent(
categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$StatisticsItem {

/// 稳定图表配色的主键。
 int get categoryId;/// 分类名称。
 String get name;/// 分类资源映射键。
 String get iconKey;/// 分类图标背景，与图表配色分开。
 String get backgroundColor;/// 精确金额字符串。
 String get amount;/// 后端百分比，例如 12.50。
 String get percentage;/// 二级分类所属父级。
 StatisticsParent? get parent;
/// Create a copy of StatisticsItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StatisticsItemCopyWith<StatisticsItem> get copyWith => _$StatisticsItemCopyWithImpl<StatisticsItem>(this as StatisticsItem, _$identity);

  /// Serializes this StatisticsItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as StatisticsItem;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StatisticsItem&&(identical(other.categoryId, _this.categoryId) || other.categoryId == _this.categoryId)&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.iconKey, _this.iconKey) || other.iconKey == _this.iconKey)&&(identical(other.backgroundColor, _this.backgroundColor) || other.backgroundColor == _this.backgroundColor)&&(identical(other.amount, _this.amount) || other.amount == _this.amount)&&(identical(other.percentage, _this.percentage) || other.percentage == _this.percentage)&&(identical(other.parent, _this.parent) || other.parent == _this.parent));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as StatisticsItem;
  return Object.hash(runtimeType,_this.categoryId,_this.name,_this.iconKey,_this.backgroundColor,_this.amount,_this.percentage,_this.parent);
}

@override
String toString() {
  final _this = this as StatisticsItem;
  return 'StatisticsItem(categoryId: ${_this.categoryId}, name: ${_this.name}, iconKey: ${_this.iconKey}, backgroundColor: ${_this.backgroundColor}, amount: ${_this.amount}, percentage: ${_this.percentage}, parent: ${_this.parent})';
}


}

/// @nodoc
abstract mixin class $StatisticsItemCopyWith<$Res>  {
  factory $StatisticsItemCopyWith(StatisticsItem value, $Res Function(StatisticsItem) _then) = _$StatisticsItemCopyWithImpl;
@useResult
$Res call({
 int categoryId, String name, String iconKey, String backgroundColor, String amount, String percentage, StatisticsParent? parent
});


$StatisticsParentCopyWith<$Res>? get parent;

}
/// @nodoc
class _$StatisticsItemCopyWithImpl<$Res>
    implements $StatisticsItemCopyWith<$Res> {
  _$StatisticsItemCopyWithImpl(this._self, this._then);

  final StatisticsItem _self;
  final $Res Function(StatisticsItem) _then;

/// Create a copy of StatisticsItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? categoryId = null,Object? name = null,Object? iconKey = null,Object? backgroundColor = null,Object? amount = null,Object? percentage = null,Object? parent = freezed,}) {
  return _then(StatisticsItem(
categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,iconKey: null == iconKey ? _self.iconKey : iconKey // ignore: cast_nullable_to_non_nullable
as String,backgroundColor: null == backgroundColor ? _self.backgroundColor : backgroundColor // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String,percentage: null == percentage ? _self.percentage : percentage // ignore: cast_nullable_to_non_nullable
as String,parent: freezed == parent ? _self.parent : parent // ignore: cast_nullable_to_non_nullable
as StatisticsParent?,
  ));
}
/// Create a copy of StatisticsItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StatisticsParentCopyWith<$Res>? get parent {
    if (_self.parent == null) {
    return null;
  }

  return $StatisticsParentCopyWith<$Res>(_self.parent!, (value) {
    return _then(_self.copyWith(parent: value));
  });
}
}


/// Adds pattern-matching-related methods to [StatisticsItem].
extension StatisticsItemPatterns on StatisticsItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StatisticsItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StatisticsItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StatisticsItem value)  $default,){
final _that = this;
switch (_that) {
case _StatisticsItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StatisticsItem value)?  $default,){
final _that = this;
switch (_that) {
case _StatisticsItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int categoryId,  String name,  String iconKey,  String backgroundColor,  String amount,  String percentage,  StatisticsParent? parent)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StatisticsItem() when $default != null:
return $default(_that.categoryId,_that.name,_that.iconKey,_that.backgroundColor,_that.amount,_that.percentage,_that.parent);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int categoryId,  String name,  String iconKey,  String backgroundColor,  String amount,  String percentage,  StatisticsParent? parent)  $default,) {final _that = this;
switch (_that) {
case _StatisticsItem():
return $default(_that.categoryId,_that.name,_that.iconKey,_that.backgroundColor,_that.amount,_that.percentage,_that.parent);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int categoryId,  String name,  String iconKey,  String backgroundColor,  String amount,  String percentage,  StatisticsParent? parent)?  $default,) {final _that = this;
switch (_that) {
case _StatisticsItem() when $default != null:
return $default(_that.categoryId,_that.name,_that.iconKey,_that.backgroundColor,_that.amount,_that.percentage,_that.parent);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StatisticsItem implements StatisticsItem {
  const _StatisticsItem({required this.categoryId, required this.name, required this.iconKey, required this.backgroundColor, required this.amount, required this.percentage, this.parent});
  factory _StatisticsItem.fromJson(Map<String, dynamic> json) => _$StatisticsItemFromJson(json);

/// 稳定图表配色的主键。
@override final  int categoryId;
/// 分类名称。
@override final  String name;
/// 分类资源映射键。
@override final  String iconKey;
/// 分类图标背景，与图表配色分开。
@override final  String backgroundColor;
/// 精确金额字符串。
@override final  String amount;
/// 后端百分比，例如 12.50。
@override final  String percentage;
/// 二级分类所属父级。
@override final  StatisticsParent? parent;

/// Create a copy of StatisticsItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StatisticsItemCopyWith<_StatisticsItem> get copyWith => __$StatisticsItemCopyWithImpl<_StatisticsItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StatisticsItemToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _StatisticsItem&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.name, name) || other.name == name)&&(identical(other.iconKey, iconKey) || other.iconKey == iconKey)&&(identical(other.backgroundColor, backgroundColor) || other.backgroundColor == backgroundColor)&&(identical(other.amount, amount) || other.amount == amount)&&(identical(other.percentage, percentage) || other.percentage == percentage)&&(identical(other.parent, parent) || other.parent == parent));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,categoryId,name,iconKey,backgroundColor,amount,percentage,parent);
}

@override
String toString() {
    return 'StatisticsItem(categoryId: $categoryId, name: $name, iconKey: $iconKey, backgroundColor: $backgroundColor, amount: $amount, percentage: $percentage, parent: $parent)';
}


}

/// @nodoc
abstract mixin class _$StatisticsItemCopyWith<$Res> implements $StatisticsItemCopyWith<$Res> {
  factory _$StatisticsItemCopyWith(_StatisticsItem value, $Res Function(_StatisticsItem) _then) = __$StatisticsItemCopyWithImpl;
@override @useResult
$Res call({
 int categoryId, String name, String iconKey, String backgroundColor, String amount, String percentage, StatisticsParent? parent
});


@override $StatisticsParentCopyWith<$Res>? get parent;

}
/// @nodoc
class __$StatisticsItemCopyWithImpl<$Res>
    implements _$StatisticsItemCopyWith<$Res> {
  __$StatisticsItemCopyWithImpl(this._self, this._then);

  final _StatisticsItem _self;
  final $Res Function(_StatisticsItem) _then;

/// Create a copy of StatisticsItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? categoryId = null,Object? name = null,Object? iconKey = null,Object? backgroundColor = null,Object? amount = null,Object? percentage = null,Object? parent = freezed,}) {
  return _then(_StatisticsItem(
categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,iconKey: null == iconKey ? _self.iconKey : iconKey // ignore: cast_nullable_to_non_nullable
as String,backgroundColor: null == backgroundColor ? _self.backgroundColor : backgroundColor // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String,percentage: null == percentage ? _self.percentage : percentage // ignore: cast_nullable_to_non_nullable
as String,parent: freezed == parent ? _self.parent : parent // ignore: cast_nullable_to_non_nullable
as StatisticsParent?,
  ));
}

/// Create a copy of StatisticsItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StatisticsParentCopyWith<$Res>? get parent {
    if (_self.parent == null) {
    return null;
  }

  return $StatisticsParentCopyWith<$Res>(_self.parent!, (value) {
    return _then(_self.copyWith(parent: value));
  });
}
}


/// @nodoc
mixin _$TrendPoint {

/// YYYY-MM-DD 或 YYYY-MM 坐标标签。
 String get date;/// 精确金额，仅绘图时转 double。
 String get amount;
/// Create a copy of TrendPoint
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TrendPointCopyWith<TrendPoint> get copyWith => _$TrendPointCopyWithImpl<TrendPoint>(this as TrendPoint, _$identity);

  /// Serializes this TrendPoint to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as TrendPoint;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TrendPoint&&(identical(other.date, _this.date) || other.date == _this.date)&&(identical(other.amount, _this.amount) || other.amount == _this.amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as TrendPoint;
  return Object.hash(runtimeType,_this.date,_this.amount);
}

@override
String toString() {
  final _this = this as TrendPoint;
  return 'TrendPoint(date: ${_this.date}, amount: ${_this.amount})';
}


}

/// @nodoc
abstract mixin class $TrendPointCopyWith<$Res>  {
  factory $TrendPointCopyWith(TrendPoint value, $Res Function(TrendPoint) _then) = _$TrendPointCopyWithImpl;
@useResult
$Res call({
 String date, String amount
});




}
/// @nodoc
class _$TrendPointCopyWithImpl<$Res>
    implements $TrendPointCopyWith<$Res> {
  _$TrendPointCopyWithImpl(this._self, this._then);

  final TrendPoint _self;
  final $Res Function(TrendPoint) _then;

/// Create a copy of TrendPoint
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? date = null,Object? amount = null,}) {
  return _then(TrendPoint(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [TrendPoint].
extension TrendPointPatterns on TrendPoint {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TrendPoint value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TrendPoint() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TrendPoint value)  $default,){
final _that = this;
switch (_that) {
case _TrendPoint():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TrendPoint value)?  $default,){
final _that = this;
switch (_that) {
case _TrendPoint() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String date,  String amount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TrendPoint() when $default != null:
return $default(_that.date,_that.amount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String date,  String amount)  $default,) {final _that = this;
switch (_that) {
case _TrendPoint():
return $default(_that.date,_that.amount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String date,  String amount)?  $default,) {final _that = this;
switch (_that) {
case _TrendPoint() when $default != null:
return $default(_that.date,_that.amount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TrendPoint implements TrendPoint {
  const _TrendPoint({required this.date, required this.amount});
  factory _TrendPoint.fromJson(Map<String, dynamic> json) => _$TrendPointFromJson(json);

/// YYYY-MM-DD 或 YYYY-MM 坐标标签。
@override final  String date;
/// 精确金额，仅绘图时转 double。
@override final  String amount;

/// Create a copy of TrendPoint
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TrendPointCopyWith<_TrendPoint> get copyWith => __$TrendPointCopyWithImpl<_TrendPoint>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TrendPointToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _TrendPoint&&(identical(other.date, date) || other.date == date)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,date,amount);
}

@override
String toString() {
    return 'TrendPoint(date: $date, amount: $amount)';
}


}

/// @nodoc
abstract mixin class _$TrendPointCopyWith<$Res> implements $TrendPointCopyWith<$Res> {
  factory _$TrendPointCopyWith(_TrendPoint value, $Res Function(_TrendPoint) _then) = __$TrendPointCopyWithImpl;
@override @useResult
$Res call({
 String date, String amount
});




}
/// @nodoc
class __$TrendPointCopyWithImpl<$Res>
    implements _$TrendPointCopyWith<$Res> {
  __$TrendPointCopyWithImpl(this._self, this._then);

  final _TrendPoint _self;
  final $Res Function(_TrendPoint) _then;

/// Create a copy of TrendPoint
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? date = null,Object? amount = null,}) {
  return _then(_TrendPoint(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$StatisticsResult {

/// 查询月份或年份。
 String get period;/// month / year。
 String get periodType;/// expense / income。
 String get type;/// 本期流水笔数。
 int get transactionCount;/// 接口计算的本期总金额。
 String get totalAmount;/// 分类统计的一级 / 二级。
 int? get categoryLevel;/// 排行 asc / desc。
 String? get order;/// 分类统计完整列表。
 List<StatisticsItem>? get items;/// 上一完整自然周期。
 String? get previousPeriod;/// 上期精确金额。
 String? get previousTotalAmount;/// 后端变化百分比，new 时可为空。
 String? get changeRate;/// increase / decrease / unchanged / new 决定文案方向。
 String? get changeStatus;/// 完整周期时间轴。
 List<TrendPoint>? get series;
/// Create a copy of StatisticsResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StatisticsResultCopyWith<StatisticsResult> get copyWith => _$StatisticsResultCopyWithImpl<StatisticsResult>(this as StatisticsResult, _$identity);

  /// Serializes this StatisticsResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as StatisticsResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StatisticsResult&&(identical(other.period, _this.period) || other.period == _this.period)&&(identical(other.periodType, _this.periodType) || other.periodType == _this.periodType)&&(identical(other.type, _this.type) || other.type == _this.type)&&(identical(other.transactionCount, _this.transactionCount) || other.transactionCount == _this.transactionCount)&&(identical(other.totalAmount, _this.totalAmount) || other.totalAmount == _this.totalAmount)&&(identical(other.categoryLevel, _this.categoryLevel) || other.categoryLevel == _this.categoryLevel)&&(identical(other.order, _this.order) || other.order == _this.order)&&const DeepCollectionEquality().equals(other.items, _this.items)&&(identical(other.previousPeriod, _this.previousPeriod) || other.previousPeriod == _this.previousPeriod)&&(identical(other.previousTotalAmount, _this.previousTotalAmount) || other.previousTotalAmount == _this.previousTotalAmount)&&(identical(other.changeRate, _this.changeRate) || other.changeRate == _this.changeRate)&&(identical(other.changeStatus, _this.changeStatus) || other.changeStatus == _this.changeStatus)&&const DeepCollectionEquality().equals(other.series, _this.series));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as StatisticsResult;
  return Object.hash(runtimeType,_this.period,_this.periodType,_this.type,_this.transactionCount,_this.totalAmount,_this.categoryLevel,_this.order,const DeepCollectionEquality().hash(_this.items),_this.previousPeriod,_this.previousTotalAmount,_this.changeRate,_this.changeStatus,const DeepCollectionEquality().hash(_this.series));
}

@override
String toString() {
  final _this = this as StatisticsResult;
  return 'StatisticsResult(period: ${_this.period}, periodType: ${_this.periodType}, type: ${_this.type}, transactionCount: ${_this.transactionCount}, totalAmount: ${_this.totalAmount}, categoryLevel: ${_this.categoryLevel}, order: ${_this.order}, items: ${_this.items}, previousPeriod: ${_this.previousPeriod}, previousTotalAmount: ${_this.previousTotalAmount}, changeRate: ${_this.changeRate}, changeStatus: ${_this.changeStatus}, series: ${_this.series})';
}


}

/// @nodoc
abstract mixin class $StatisticsResultCopyWith<$Res>  {
  factory $StatisticsResultCopyWith(StatisticsResult value, $Res Function(StatisticsResult) _then) = _$StatisticsResultCopyWithImpl;
@useResult
$Res call({
 String period, String periodType, String type, int transactionCount, String totalAmount, int? categoryLevel, String? order, List<StatisticsItem>? items, String? previousPeriod, String? previousTotalAmount, String? changeRate, String? changeStatus, List<TrendPoint>? series
});




}
/// @nodoc
class _$StatisticsResultCopyWithImpl<$Res>
    implements $StatisticsResultCopyWith<$Res> {
  _$StatisticsResultCopyWithImpl(this._self, this._then);

  final StatisticsResult _self;
  final $Res Function(StatisticsResult) _then;

/// Create a copy of StatisticsResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? period = null,Object? periodType = null,Object? type = null,Object? transactionCount = null,Object? totalAmount = null,Object? categoryLevel = freezed,Object? order = freezed,Object? items = freezed,Object? previousPeriod = freezed,Object? previousTotalAmount = freezed,Object? changeRate = freezed,Object? changeStatus = freezed,Object? series = freezed,}) {
  return _then(StatisticsResult(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,periodType: null == periodType ? _self.periodType : periodType // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,transactionCount: null == transactionCount ? _self.transactionCount : transactionCount // ignore: cast_nullable_to_non_nullable
as int,totalAmount: null == totalAmount ? _self.totalAmount : totalAmount // ignore: cast_nullable_to_non_nullable
as String,categoryLevel: freezed == categoryLevel ? _self.categoryLevel : categoryLevel // ignore: cast_nullable_to_non_nullable
as int?,order: freezed == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as String?,items: freezed == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<StatisticsItem>?,previousPeriod: freezed == previousPeriod ? _self.previousPeriod : previousPeriod // ignore: cast_nullable_to_non_nullable
as String?,previousTotalAmount: freezed == previousTotalAmount ? _self.previousTotalAmount : previousTotalAmount // ignore: cast_nullable_to_non_nullable
as String?,changeRate: freezed == changeRate ? _self.changeRate : changeRate // ignore: cast_nullable_to_non_nullable
as String?,changeStatus: freezed == changeStatus ? _self.changeStatus : changeStatus // ignore: cast_nullable_to_non_nullable
as String?,series: freezed == series ? _self.series : series // ignore: cast_nullable_to_non_nullable
as List<TrendPoint>?,
  ));
}

}


/// Adds pattern-matching-related methods to [StatisticsResult].
extension StatisticsResultPatterns on StatisticsResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StatisticsResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StatisticsResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StatisticsResult value)  $default,){
final _that = this;
switch (_that) {
case _StatisticsResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StatisticsResult value)?  $default,){
final _that = this;
switch (_that) {
case _StatisticsResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String period,  String periodType,  String type,  int transactionCount,  String totalAmount,  int? categoryLevel,  String? order,  List<StatisticsItem>? items,  String? previousPeriod,  String? previousTotalAmount,  String? changeRate,  String? changeStatus,  List<TrendPoint>? series)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StatisticsResult() when $default != null:
return $default(_that.period,_that.periodType,_that.type,_that.transactionCount,_that.totalAmount,_that.categoryLevel,_that.order,_that.items,_that.previousPeriod,_that.previousTotalAmount,_that.changeRate,_that.changeStatus,_that.series);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String period,  String periodType,  String type,  int transactionCount,  String totalAmount,  int? categoryLevel,  String? order,  List<StatisticsItem>? items,  String? previousPeriod,  String? previousTotalAmount,  String? changeRate,  String? changeStatus,  List<TrendPoint>? series)  $default,) {final _that = this;
switch (_that) {
case _StatisticsResult():
return $default(_that.period,_that.periodType,_that.type,_that.transactionCount,_that.totalAmount,_that.categoryLevel,_that.order,_that.items,_that.previousPeriod,_that.previousTotalAmount,_that.changeRate,_that.changeStatus,_that.series);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String period,  String periodType,  String type,  int transactionCount,  String totalAmount,  int? categoryLevel,  String? order,  List<StatisticsItem>? items,  String? previousPeriod,  String? previousTotalAmount,  String? changeRate,  String? changeStatus,  List<TrendPoint>? series)?  $default,) {final _that = this;
switch (_that) {
case _StatisticsResult() when $default != null:
return $default(_that.period,_that.periodType,_that.type,_that.transactionCount,_that.totalAmount,_that.categoryLevel,_that.order,_that.items,_that.previousPeriod,_that.previousTotalAmount,_that.changeRate,_that.changeStatus,_that.series);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StatisticsResult implements StatisticsResult {
  const _StatisticsResult({required this.period, required this.periodType, required this.type, required this.transactionCount, required this.totalAmount, this.categoryLevel, this.order,  List<StatisticsItem>? items, this.previousPeriod, this.previousTotalAmount, this.changeRate, this.changeStatus,  List<TrendPoint>? series}): _items = items,_series = series;
  factory _StatisticsResult.fromJson(Map<String, dynamic> json) => _$StatisticsResultFromJson(json);

/// 查询月份或年份。
@override final  String period;
/// month / year。
@override final  String periodType;
/// expense / income。
@override final  String type;
/// 本期流水笔数。
@override final  int transactionCount;
/// 接口计算的本期总金额。
@override final  String totalAmount;
/// 分类统计的一级 / 二级。
@override final  int? categoryLevel;
/// 排行 asc / desc。
@override final  String? order;
/// 分类统计完整列表。
 final  List<StatisticsItem>? _items;
/// 分类统计完整列表。
@override List<StatisticsItem>? get items {
  final value = _items;
  if (value == null) return null;
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// 上一完整自然周期。
@override final  String? previousPeriod;
/// 上期精确金额。
@override final  String? previousTotalAmount;
/// 后端变化百分比，new 时可为空。
@override final  String? changeRate;
/// increase / decrease / unchanged / new 决定文案方向。
@override final  String? changeStatus;
/// 完整周期时间轴。
 final  List<TrendPoint>? _series;
/// 完整周期时间轴。
@override List<TrendPoint>? get series {
  final value = _series;
  if (value == null) return null;
  if (_series is EqualUnmodifiableListView) return _series;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of StatisticsResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StatisticsResultCopyWith<_StatisticsResult> get copyWith => __$StatisticsResultCopyWithImpl<_StatisticsResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StatisticsResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _StatisticsResult&&(identical(other.period, period) || other.period == period)&&(identical(other.periodType, periodType) || other.periodType == periodType)&&(identical(other.type, type) || other.type == type)&&(identical(other.transactionCount, transactionCount) || other.transactionCount == transactionCount)&&(identical(other.totalAmount, totalAmount) || other.totalAmount == totalAmount)&&(identical(other.categoryLevel, categoryLevel) || other.categoryLevel == categoryLevel)&&(identical(other.order, order) || other.order == order)&&const DeepCollectionEquality().equals(other.items, _items)&&(identical(other.previousPeriod, previousPeriod) || other.previousPeriod == previousPeriod)&&(identical(other.previousTotalAmount, previousTotalAmount) || other.previousTotalAmount == previousTotalAmount)&&(identical(other.changeRate, changeRate) || other.changeRate == changeRate)&&(identical(other.changeStatus, changeStatus) || other.changeStatus == changeStatus)&&const DeepCollectionEquality().equals(other.series, _series));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,period,periodType,type,transactionCount,totalAmount,categoryLevel,order,const DeepCollectionEquality().hash(_items),previousPeriod,previousTotalAmount,changeRate,changeStatus,const DeepCollectionEquality().hash(_series));
}

@override
String toString() {
    return 'StatisticsResult(period: $period, periodType: $periodType, type: $type, transactionCount: $transactionCount, totalAmount: $totalAmount, categoryLevel: $categoryLevel, order: $order, items: $items, previousPeriod: $previousPeriod, previousTotalAmount: $previousTotalAmount, changeRate: $changeRate, changeStatus: $changeStatus, series: $series)';
}


}

/// @nodoc
abstract mixin class _$StatisticsResultCopyWith<$Res> implements $StatisticsResultCopyWith<$Res> {
  factory _$StatisticsResultCopyWith(_StatisticsResult value, $Res Function(_StatisticsResult) _then) = __$StatisticsResultCopyWithImpl;
@override @useResult
$Res call({
 String period, String periodType, String type, int transactionCount, String totalAmount, int? categoryLevel, String? order, List<StatisticsItem>? items, String? previousPeriod, String? previousTotalAmount, String? changeRate, String? changeStatus, List<TrendPoint>? series
});




}
/// @nodoc
class __$StatisticsResultCopyWithImpl<$Res>
    implements _$StatisticsResultCopyWith<$Res> {
  __$StatisticsResultCopyWithImpl(this._self, this._then);

  final _StatisticsResult _self;
  final $Res Function(_StatisticsResult) _then;

/// Create a copy of StatisticsResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? period = null,Object? periodType = null,Object? type = null,Object? transactionCount = null,Object? totalAmount = null,Object? categoryLevel = freezed,Object? order = freezed,Object? items = freezed,Object? previousPeriod = freezed,Object? previousTotalAmount = freezed,Object? changeRate = freezed,Object? changeStatus = freezed,Object? series = freezed,}) {
  return _then(_StatisticsResult(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,periodType: null == periodType ? _self.periodType : periodType // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,transactionCount: null == transactionCount ? _self.transactionCount : transactionCount // ignore: cast_nullable_to_non_nullable
as int,totalAmount: null == totalAmount ? _self.totalAmount : totalAmount // ignore: cast_nullable_to_non_nullable
as String,categoryLevel: freezed == categoryLevel ? _self.categoryLevel : categoryLevel // ignore: cast_nullable_to_non_nullable
as int?,order: freezed == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as String?,items: freezed == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<StatisticsItem>?,previousPeriod: freezed == previousPeriod ? _self.previousPeriod : previousPeriod // ignore: cast_nullable_to_non_nullable
as String?,previousTotalAmount: freezed == previousTotalAmount ? _self.previousTotalAmount : previousTotalAmount // ignore: cast_nullable_to_non_nullable
as String?,changeRate: freezed == changeRate ? _self.changeRate : changeRate // ignore: cast_nullable_to_non_nullable
as String?,changeStatus: freezed == changeStatus ? _self.changeStatus : changeStatus // ignore: cast_nullable_to_non_nullable
as String?,series: freezed == series ? _self._series : series // ignore: cast_nullable_to_non_nullable
as List<TrendPoint>?,
  ));
}


}

// dart format on
