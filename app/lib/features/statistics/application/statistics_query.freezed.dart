// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'statistics_query.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$StatisticsQuery {

/// 当前统计板块。
 String get panel;/// 保留的月份 YYYY-MM。
 String get month;/// 保留的年份 YYYY。
 String get year;/// true 查询完整自然年。
 bool get yearly;/// 统计不提供全部收支。
 EntryType get type;/// 支出一级 / 二级，收入序列化强制一级。
 int get level;/// 仅排行使用，默认金额降序。
 bool get ascending;
/// Create a copy of StatisticsQuery
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StatisticsQueryCopyWith<StatisticsQuery> get copyWith => _$StatisticsQueryCopyWithImpl<StatisticsQuery>(this as StatisticsQuery, _$identity);



@override
bool operator ==(Object other) {
  final _this = this as StatisticsQuery;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StatisticsQuery&&(identical(other.panel, _this.panel) || other.panel == _this.panel)&&(identical(other.month, _this.month) || other.month == _this.month)&&(identical(other.year, _this.year) || other.year == _this.year)&&(identical(other.yearly, _this.yearly) || other.yearly == _this.yearly)&&(identical(other.type, _this.type) || other.type == _this.type)&&(identical(other.level, _this.level) || other.level == _this.level)&&(identical(other.ascending, _this.ascending) || other.ascending == _this.ascending));
}


@override
int get hashCode {
  final _this = this as StatisticsQuery;
  return Object.hash(runtimeType,_this.panel,_this.month,_this.year,_this.yearly,_this.type,_this.level,_this.ascending);
}

@override
String toString() {
  final _this = this as StatisticsQuery;
  return 'StatisticsQuery(panel: ${_this.panel}, month: ${_this.month}, year: ${_this.year}, yearly: ${_this.yearly}, type: ${_this.type}, level: ${_this.level}, ascending: ${_this.ascending})';
}


}

/// @nodoc
abstract mixin class $StatisticsQueryCopyWith<$Res>  {
  factory $StatisticsQueryCopyWith(StatisticsQuery value, $Res Function(StatisticsQuery) _then) = _$StatisticsQueryCopyWithImpl;
@useResult
$Res call({
 String panel, String month, String year, bool yearly, EntryType type, int level, bool ascending
});




}
/// @nodoc
class _$StatisticsQueryCopyWithImpl<$Res>
    implements $StatisticsQueryCopyWith<$Res> {
  _$StatisticsQueryCopyWithImpl(this._self, this._then);

  final StatisticsQuery _self;
  final $Res Function(StatisticsQuery) _then;

/// Create a copy of StatisticsQuery
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? panel = null,Object? month = null,Object? year = null,Object? yearly = null,Object? type = null,Object? level = null,Object? ascending = null,}) {
  return _then(StatisticsQuery(
panel: null == panel ? _self.panel : panel // ignore: cast_nullable_to_non_nullable
as String,month: null == month ? _self.month : month // ignore: cast_nullable_to_non_nullable
as String,year: null == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as String,yearly: null == yearly ? _self.yearly : yearly // ignore: cast_nullable_to_non_nullable
as bool,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as int,ascending: null == ascending ? _self.ascending : ascending // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [StatisticsQuery].
extension StatisticsQueryPatterns on StatisticsQuery {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StatisticsQuery value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StatisticsQuery() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StatisticsQuery value)  $default,){
final _that = this;
switch (_that) {
case _StatisticsQuery():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StatisticsQuery value)?  $default,){
final _that = this;
switch (_that) {
case _StatisticsQuery() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String panel,  String month,  String year,  bool yearly,  EntryType type,  int level,  bool ascending)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StatisticsQuery() when $default != null:
return $default(_that.panel,_that.month,_that.year,_that.yearly,_that.type,_that.level,_that.ascending);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String panel,  String month,  String year,  bool yearly,  EntryType type,  int level,  bool ascending)  $default,) {final _that = this;
switch (_that) {
case _StatisticsQuery():
return $default(_that.panel,_that.month,_that.year,_that.yearly,_that.type,_that.level,_that.ascending);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String panel,  String month,  String year,  bool yearly,  EntryType type,  int level,  bool ascending)?  $default,) {final _that = this;
switch (_that) {
case _StatisticsQuery() when $default != null:
return $default(_that.panel,_that.month,_that.year,_that.yearly,_that.type,_that.level,_that.ascending);case _:
  return null;

}
}

}

/// @nodoc


class _StatisticsQuery extends StatisticsQuery {
  const _StatisticsQuery({required this.panel, required this.month, required this.year, this.yearly = false, this.type = EntryType.expense, this.level = 1, this.ascending = false}): super._();
  

/// 当前统计板块。
@override final  String panel;
/// 保留的月份 YYYY-MM。
@override final  String month;
/// 保留的年份 YYYY。
@override final  String year;
/// true 查询完整自然年。
@override@JsonKey() final  bool yearly;
/// 统计不提供全部收支。
@override@JsonKey() final  EntryType type;
/// 支出一级 / 二级，收入序列化强制一级。
@override@JsonKey() final  int level;
/// 仅排行使用，默认金额降序。
@override@JsonKey() final  bool ascending;

/// Create a copy of StatisticsQuery
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StatisticsQueryCopyWith<_StatisticsQuery> get copyWith => __$StatisticsQueryCopyWithImpl<_StatisticsQuery>(this, _$identity);



@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _StatisticsQuery&&(identical(other.panel, panel) || other.panel == panel)&&(identical(other.month, month) || other.month == month)&&(identical(other.year, year) || other.year == year)&&(identical(other.yearly, yearly) || other.yearly == yearly)&&(identical(other.type, type) || other.type == type)&&(identical(other.level, level) || other.level == level)&&(identical(other.ascending, ascending) || other.ascending == ascending));
}


@override
int get hashCode {
    return Object.hash(runtimeType,panel,month,year,yearly,type,level,ascending);
}

@override
String toString() {
    return 'StatisticsQuery(panel: $panel, month: $month, year: $year, yearly: $yearly, type: $type, level: $level, ascending: $ascending)';
}


}

/// @nodoc
abstract mixin class _$StatisticsQueryCopyWith<$Res> implements $StatisticsQueryCopyWith<$Res> {
  factory _$StatisticsQueryCopyWith(_StatisticsQuery value, $Res Function(_StatisticsQuery) _then) = __$StatisticsQueryCopyWithImpl;
@override @useResult
$Res call({
 String panel, String month, String year, bool yearly, EntryType type, int level, bool ascending
});




}
/// @nodoc
class __$StatisticsQueryCopyWithImpl<$Res>
    implements _$StatisticsQueryCopyWith<$Res> {
  __$StatisticsQueryCopyWithImpl(this._self, this._then);

  final _StatisticsQuery _self;
  final $Res Function(_StatisticsQuery) _then;

/// Create a copy of StatisticsQuery
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? panel = null,Object? month = null,Object? year = null,Object? yearly = null,Object? type = null,Object? level = null,Object? ascending = null,}) {
  return _then(_StatisticsQuery(
panel: null == panel ? _self.panel : panel // ignore: cast_nullable_to_non_nullable
as String,month: null == month ? _self.month : month // ignore: cast_nullable_to_non_nullable
as String,year: null == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as String,yearly: null == yearly ? _self.yearly : yearly // ignore: cast_nullable_to_non_nullable
as bool,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as int,ascending: null == ascending ? _self.ascending : ascending // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
