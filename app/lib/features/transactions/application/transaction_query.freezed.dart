// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'transaction_query.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$TransactionQuery {

/// 当前模式的周期字符串。
 String get period;/// false 为日明细，true 为年内月汇总。
 bool get monthly;/// null 表示全部，序列化时省略。
 EntryType? get type;/// 历史分类筛选主键。
 List<int> get categoryIds;/// 日明细任一标签匹配主键。
 List<int> get tagIds;/// 非负最小金额字符串，空时省略。
 String get minAmount;/// 非负最大金额字符串，空时省略。
 String get maxAmount;/// 日明细标题关键词。
 String get title;/// 日明细备注关键词。
 String get remark;
/// Create a copy of TransactionQuery
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TransactionQueryCopyWith<TransactionQuery> get copyWith => _$TransactionQueryCopyWithImpl<TransactionQuery>(this as TransactionQuery, _$identity);



@override
bool operator ==(Object other) {
  final _this = this as TransactionQuery;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TransactionQuery&&(identical(other.period, _this.period) || other.period == _this.period)&&(identical(other.monthly, _this.monthly) || other.monthly == _this.monthly)&&(identical(other.type, _this.type) || other.type == _this.type)&&const DeepCollectionEquality().equals(other.categoryIds, _this.categoryIds)&&const DeepCollectionEquality().equals(other.tagIds, _this.tagIds)&&(identical(other.minAmount, _this.minAmount) || other.minAmount == _this.minAmount)&&(identical(other.maxAmount, _this.maxAmount) || other.maxAmount == _this.maxAmount)&&(identical(other.title, _this.title) || other.title == _this.title)&&(identical(other.remark, _this.remark) || other.remark == _this.remark));
}


@override
int get hashCode {
  final _this = this as TransactionQuery;
  return Object.hash(runtimeType,_this.period,_this.monthly,_this.type,const DeepCollectionEquality().hash(_this.categoryIds),const DeepCollectionEquality().hash(_this.tagIds),_this.minAmount,_this.maxAmount,_this.title,_this.remark);
}

@override
String toString() {
  final _this = this as TransactionQuery;
  return 'TransactionQuery(period: ${_this.period}, monthly: ${_this.monthly}, type: ${_this.type}, categoryIds: ${_this.categoryIds}, tagIds: ${_this.tagIds}, minAmount: ${_this.minAmount}, maxAmount: ${_this.maxAmount}, title: ${_this.title}, remark: ${_this.remark})';
}


}

/// @nodoc
abstract mixin class $TransactionQueryCopyWith<$Res>  {
  factory $TransactionQueryCopyWith(TransactionQuery value, $Res Function(TransactionQuery) _then) = _$TransactionQueryCopyWithImpl;
@useResult
$Res call({
 String period, bool monthly, EntryType? type, List<int> categoryIds, List<int> tagIds, String minAmount, String maxAmount, String title, String remark
});




}
/// @nodoc
class _$TransactionQueryCopyWithImpl<$Res>
    implements $TransactionQueryCopyWith<$Res> {
  _$TransactionQueryCopyWithImpl(this._self, this._then);

  final TransactionQuery _self;
  final $Res Function(TransactionQuery) _then;

/// Create a copy of TransactionQuery
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? period = null,Object? monthly = null,Object? type = freezed,Object? categoryIds = null,Object? tagIds = null,Object? minAmount = null,Object? maxAmount = null,Object? title = null,Object? remark = null,}) {
  return _then(TransactionQuery(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,monthly: null == monthly ? _self.monthly : monthly // ignore: cast_nullable_to_non_nullable
as bool,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType?,categoryIds: null == categoryIds ? _self.categoryIds : categoryIds // ignore: cast_nullable_to_non_nullable
as List<int>,tagIds: null == tagIds ? _self.tagIds : tagIds // ignore: cast_nullable_to_non_nullable
as List<int>,minAmount: null == minAmount ? _self.minAmount : minAmount // ignore: cast_nullable_to_non_nullable
as String,maxAmount: null == maxAmount ? _self.maxAmount : maxAmount // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,remark: null == remark ? _self.remark : remark // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [TransactionQuery].
extension TransactionQueryPatterns on TransactionQuery {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TransactionQuery value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TransactionQuery() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TransactionQuery value)  $default,){
final _that = this;
switch (_that) {
case _TransactionQuery():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TransactionQuery value)?  $default,){
final _that = this;
switch (_that) {
case _TransactionQuery() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String period,  bool monthly,  EntryType? type,  List<int> categoryIds,  List<int> tagIds,  String minAmount,  String maxAmount,  String title,  String remark)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TransactionQuery() when $default != null:
return $default(_that.period,_that.monthly,_that.type,_that.categoryIds,_that.tagIds,_that.minAmount,_that.maxAmount,_that.title,_that.remark);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String period,  bool monthly,  EntryType? type,  List<int> categoryIds,  List<int> tagIds,  String minAmount,  String maxAmount,  String title,  String remark)  $default,) {final _that = this;
switch (_that) {
case _TransactionQuery():
return $default(_that.period,_that.monthly,_that.type,_that.categoryIds,_that.tagIds,_that.minAmount,_that.maxAmount,_that.title,_that.remark);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String period,  bool monthly,  EntryType? type,  List<int> categoryIds,  List<int> tagIds,  String minAmount,  String maxAmount,  String title,  String remark)?  $default,) {final _that = this;
switch (_that) {
case _TransactionQuery() when $default != null:
return $default(_that.period,_that.monthly,_that.type,_that.categoryIds,_that.tagIds,_that.minAmount,_that.maxAmount,_that.title,_that.remark);case _:
  return null;

}
}

}

/// @nodoc


class _TransactionQuery extends TransactionQuery {
  const _TransactionQuery({required this.period, this.monthly = false, this.type,  List<int> categoryIds = const [],  List<int> tagIds = const [], this.minAmount = '', this.maxAmount = '', this.title = '', this.remark = ''}): _categoryIds = categoryIds,_tagIds = tagIds,super._();
  

/// 当前模式的周期字符串。
@override final  String period;
/// false 为日明细，true 为年内月汇总。
@override@JsonKey() final  bool monthly;
/// null 表示全部，序列化时省略。
@override final  EntryType? type;
/// 历史分类筛选主键。
 final  List<int> _categoryIds;
/// 历史分类筛选主键。
@override@JsonKey() List<int> get categoryIds {
  if (_categoryIds is EqualUnmodifiableListView) return _categoryIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_categoryIds);
}

/// 日明细任一标签匹配主键。
 final  List<int> _tagIds;
/// 日明细任一标签匹配主键。
@override@JsonKey() List<int> get tagIds {
  if (_tagIds is EqualUnmodifiableListView) return _tagIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tagIds);
}

/// 非负最小金额字符串，空时省略。
@override@JsonKey() final  String minAmount;
/// 非负最大金额字符串，空时省略。
@override@JsonKey() final  String maxAmount;
/// 日明细标题关键词。
@override@JsonKey() final  String title;
/// 日明细备注关键词。
@override@JsonKey() final  String remark;

/// Create a copy of TransactionQuery
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TransactionQueryCopyWith<_TransactionQuery> get copyWith => __$TransactionQueryCopyWithImpl<_TransactionQuery>(this, _$identity);



@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _TransactionQuery&&(identical(other.period, period) || other.period == period)&&(identical(other.monthly, monthly) || other.monthly == monthly)&&(identical(other.type, type) || other.type == type)&&const DeepCollectionEquality().equals(other.categoryIds, _categoryIds)&&const DeepCollectionEquality().equals(other.tagIds, _tagIds)&&(identical(other.minAmount, minAmount) || other.minAmount == minAmount)&&(identical(other.maxAmount, maxAmount) || other.maxAmount == maxAmount)&&(identical(other.title, title) || other.title == title)&&(identical(other.remark, remark) || other.remark == remark));
}


@override
int get hashCode {
    return Object.hash(runtimeType,period,monthly,type,const DeepCollectionEquality().hash(_categoryIds),const DeepCollectionEquality().hash(_tagIds),minAmount,maxAmount,title,remark);
}

@override
String toString() {
    return 'TransactionQuery(period: $period, monthly: $monthly, type: $type, categoryIds: $categoryIds, tagIds: $tagIds, minAmount: $minAmount, maxAmount: $maxAmount, title: $title, remark: $remark)';
}


}

/// @nodoc
abstract mixin class _$TransactionQueryCopyWith<$Res> implements $TransactionQueryCopyWith<$Res> {
  factory _$TransactionQueryCopyWith(_TransactionQuery value, $Res Function(_TransactionQuery) _then) = __$TransactionQueryCopyWithImpl;
@override @useResult
$Res call({
 String period, bool monthly, EntryType? type, List<int> categoryIds, List<int> tagIds, String minAmount, String maxAmount, String title, String remark
});




}
/// @nodoc
class __$TransactionQueryCopyWithImpl<$Res>
    implements _$TransactionQueryCopyWith<$Res> {
  __$TransactionQueryCopyWithImpl(this._self, this._then);

  final _TransactionQuery _self;
  final $Res Function(_TransactionQuery) _then;

/// Create a copy of TransactionQuery
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? period = null,Object? monthly = null,Object? type = freezed,Object? categoryIds = null,Object? tagIds = null,Object? minAmount = null,Object? maxAmount = null,Object? title = null,Object? remark = null,}) {
  return _then(_TransactionQuery(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,monthly: null == monthly ? _self.monthly : monthly // ignore: cast_nullable_to_non_nullable
as bool,type: freezed == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType?,categoryIds: null == categoryIds ? _self._categoryIds : categoryIds // ignore: cast_nullable_to_non_nullable
as List<int>,tagIds: null == tagIds ? _self._tagIds : tagIds // ignore: cast_nullable_to_non_nullable
as List<int>,minAmount: null == minAmount ? _self.minAmount : minAmount // ignore: cast_nullable_to_non_nullable
as String,maxAmount: null == maxAmount ? _self.maxAmount : maxAmount // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,remark: null == remark ? _self.remark : remark // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
