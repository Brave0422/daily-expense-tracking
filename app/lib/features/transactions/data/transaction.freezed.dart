// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'transaction.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$TransactionCategory {

/// 必有的一级分类历史信息。
 Category get primary;/// 收入不提供二级分类。
 Category? get secondary;
/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TransactionCategoryCopyWith<TransactionCategory> get copyWith => _$TransactionCategoryCopyWithImpl<TransactionCategory>(this as TransactionCategory, _$identity);

  /// Serializes this TransactionCategory to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as TransactionCategory;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TransactionCategory&&(identical(other.primary, _this.primary) || other.primary == _this.primary)&&(identical(other.secondary, _this.secondary) || other.secondary == _this.secondary));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as TransactionCategory;
  return Object.hash(runtimeType,_this.primary,_this.secondary);
}

@override
String toString() {
  final _this = this as TransactionCategory;
  return 'TransactionCategory(primary: ${_this.primary}, secondary: ${_this.secondary})';
}


}

/// @nodoc
abstract mixin class $TransactionCategoryCopyWith<$Res>  {
  factory $TransactionCategoryCopyWith(TransactionCategory value, $Res Function(TransactionCategory) _then) = _$TransactionCategoryCopyWithImpl;
@useResult
$Res call({
 Category primary, Category? secondary
});


$CategoryCopyWith<$Res> get primary;$CategoryCopyWith<$Res>? get secondary;

}
/// @nodoc
class _$TransactionCategoryCopyWithImpl<$Res>
    implements $TransactionCategoryCopyWith<$Res> {
  _$TransactionCategoryCopyWithImpl(this._self, this._then);

  final TransactionCategory _self;
  final $Res Function(TransactionCategory) _then;

/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? primary = null,Object? secondary = freezed,}) {
  return _then(TransactionCategory(
primary: null == primary ? _self.primary : primary // ignore: cast_nullable_to_non_nullable
as Category,secondary: freezed == secondary ? _self.secondary : secondary // ignore: cast_nullable_to_non_nullable
as Category?,
  ));
}
/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CategoryCopyWith<$Res> get primary {
  
  return $CategoryCopyWith<$Res>(_self.primary, (value) {
    return _then(_self.copyWith(primary: value));
  });
}/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CategoryCopyWith<$Res>? get secondary {
    if (_self.secondary == null) {
    return null;
  }

  return $CategoryCopyWith<$Res>(_self.secondary!, (value) {
    return _then(_self.copyWith(secondary: value));
  });
}
}


/// Adds pattern-matching-related methods to [TransactionCategory].
extension TransactionCategoryPatterns on TransactionCategory {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TransactionCategory value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TransactionCategory() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TransactionCategory value)  $default,){
final _that = this;
switch (_that) {
case _TransactionCategory():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TransactionCategory value)?  $default,){
final _that = this;
switch (_that) {
case _TransactionCategory() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( Category primary,  Category? secondary)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TransactionCategory() when $default != null:
return $default(_that.primary,_that.secondary);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( Category primary,  Category? secondary)  $default,) {final _that = this;
switch (_that) {
case _TransactionCategory():
return $default(_that.primary,_that.secondary);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( Category primary,  Category? secondary)?  $default,) {final _that = this;
switch (_that) {
case _TransactionCategory() when $default != null:
return $default(_that.primary,_that.secondary);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TransactionCategory implements TransactionCategory {
  const _TransactionCategory({required this.primary, this.secondary});
  factory _TransactionCategory.fromJson(Map<String, dynamic> json) => _$TransactionCategoryFromJson(json);

/// 必有的一级分类历史信息。
@override final  Category primary;
/// 收入不提供二级分类。
@override final  Category? secondary;

/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TransactionCategoryCopyWith<_TransactionCategory> get copyWith => __$TransactionCategoryCopyWithImpl<_TransactionCategory>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TransactionCategoryToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _TransactionCategory&&(identical(other.primary, primary) || other.primary == primary)&&(identical(other.secondary, secondary) || other.secondary == secondary));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,primary,secondary);
}

@override
String toString() {
    return 'TransactionCategory(primary: $primary, secondary: $secondary)';
}


}

/// @nodoc
abstract mixin class _$TransactionCategoryCopyWith<$Res> implements $TransactionCategoryCopyWith<$Res> {
  factory _$TransactionCategoryCopyWith(_TransactionCategory value, $Res Function(_TransactionCategory) _then) = __$TransactionCategoryCopyWithImpl;
@override @useResult
$Res call({
 Category primary, Category? secondary
});


@override $CategoryCopyWith<$Res> get primary;@override $CategoryCopyWith<$Res>? get secondary;

}
/// @nodoc
class __$TransactionCategoryCopyWithImpl<$Res>
    implements _$TransactionCategoryCopyWith<$Res> {
  __$TransactionCategoryCopyWithImpl(this._self, this._then);

  final _TransactionCategory _self;
  final $Res Function(_TransactionCategory) _then;

/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? primary = null,Object? secondary = freezed,}) {
  return _then(_TransactionCategory(
primary: null == primary ? _self.primary : primary // ignore: cast_nullable_to_non_nullable
as Category,secondary: freezed == secondary ? _self.secondary : secondary // ignore: cast_nullable_to_non_nullable
as Category?,
  ));
}

/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CategoryCopyWith<$Res> get primary {
  
  return $CategoryCopyWith<$Res>(_self.primary, (value) {
    return _then(_self.copyWith(primary: value));
  });
}/// Create a copy of TransactionCategory
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CategoryCopyWith<$Res>? get secondary {
    if (_self.secondary == null) {
    return null;
  }

  return $CategoryCopyWith<$Res>(_self.secondary!, (value) {
    return _then(_self.copyWith(secondary: value));
  });
}
}


/// @nodoc
mixin _$TransactionItem {

/// 服务端流水主键。
 int get id;/// 收支方向。
 EntryType get type;/// 人民币元字符串，不通过浮点回填。
 String get amount;/// YYYY-MM-DD 业务自然日期。
 String get occurredDate;/// 一、二级分类历史展示。
 TransactionCategory get category;/// 可选标题。
 String? get title;/// 可选备注。
 String? get remark;/// 当前记录关联的完整标签集合。
 List<Tag> get tags;
/// Create a copy of TransactionItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TransactionItemCopyWith<TransactionItem> get copyWith => _$TransactionItemCopyWithImpl<TransactionItem>(this as TransactionItem, _$identity);

  /// Serializes this TransactionItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as TransactionItem;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TransactionItem&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.type, _this.type) || other.type == _this.type)&&(identical(other.amount, _this.amount) || other.amount == _this.amount)&&(identical(other.occurredDate, _this.occurredDate) || other.occurredDate == _this.occurredDate)&&(identical(other.category, _this.category) || other.category == _this.category)&&(identical(other.title, _this.title) || other.title == _this.title)&&(identical(other.remark, _this.remark) || other.remark == _this.remark)&&const DeepCollectionEquality().equals(other.tags, _this.tags));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as TransactionItem;
  return Object.hash(runtimeType,_this.id,_this.type,_this.amount,_this.occurredDate,_this.category,_this.title,_this.remark,const DeepCollectionEquality().hash(_this.tags));
}

@override
String toString() {
  final _this = this as TransactionItem;
  return 'TransactionItem(id: ${_this.id}, type: ${_this.type}, amount: ${_this.amount}, occurredDate: ${_this.occurredDate}, category: ${_this.category}, title: ${_this.title}, remark: ${_this.remark}, tags: ${_this.tags})';
}


}

/// @nodoc
abstract mixin class $TransactionItemCopyWith<$Res>  {
  factory $TransactionItemCopyWith(TransactionItem value, $Res Function(TransactionItem) _then) = _$TransactionItemCopyWithImpl;
@useResult
$Res call({
 int id, EntryType type, String amount, String occurredDate, TransactionCategory category, String? title, String? remark, List<Tag> tags
});


$TransactionCategoryCopyWith<$Res> get category;

}
/// @nodoc
class _$TransactionItemCopyWithImpl<$Res>
    implements $TransactionItemCopyWith<$Res> {
  _$TransactionItemCopyWithImpl(this._self, this._then);

  final TransactionItem _self;
  final $Res Function(TransactionItem) _then;

/// Create a copy of TransactionItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? type = null,Object? amount = null,Object? occurredDate = null,Object? category = null,Object? title = freezed,Object? remark = freezed,Object? tags = null,}) {
  return _then(TransactionItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String,occurredDate: null == occurredDate ? _self.occurredDate : occurredDate // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as TransactionCategory,title: freezed == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String?,remark: freezed == remark ? _self.remark : remark // ignore: cast_nullable_to_non_nullable
as String?,tags: null == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<Tag>,
  ));
}
/// Create a copy of TransactionItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TransactionCategoryCopyWith<$Res> get category {
  
  return $TransactionCategoryCopyWith<$Res>(_self.category, (value) {
    return _then(_self.copyWith(category: value));
  });
}
}


/// Adds pattern-matching-related methods to [TransactionItem].
extension TransactionItemPatterns on TransactionItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TransactionItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TransactionItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TransactionItem value)  $default,){
final _that = this;
switch (_that) {
case _TransactionItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TransactionItem value)?  $default,){
final _that = this;
switch (_that) {
case _TransactionItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  EntryType type,  String amount,  String occurredDate,  TransactionCategory category,  String? title,  String? remark,  List<Tag> tags)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TransactionItem() when $default != null:
return $default(_that.id,_that.type,_that.amount,_that.occurredDate,_that.category,_that.title,_that.remark,_that.tags);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  EntryType type,  String amount,  String occurredDate,  TransactionCategory category,  String? title,  String? remark,  List<Tag> tags)  $default,) {final _that = this;
switch (_that) {
case _TransactionItem():
return $default(_that.id,_that.type,_that.amount,_that.occurredDate,_that.category,_that.title,_that.remark,_that.tags);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  EntryType type,  String amount,  String occurredDate,  TransactionCategory category,  String? title,  String? remark,  List<Tag> tags)?  $default,) {final _that = this;
switch (_that) {
case _TransactionItem() when $default != null:
return $default(_that.id,_that.type,_that.amount,_that.occurredDate,_that.category,_that.title,_that.remark,_that.tags);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TransactionItem implements TransactionItem {
  const _TransactionItem({required this.id, required this.type, required this.amount, required this.occurredDate, required this.category, this.title, this.remark, required  List<Tag> tags}): _tags = tags;
  factory _TransactionItem.fromJson(Map<String, dynamic> json) => _$TransactionItemFromJson(json);

/// 服务端流水主键。
@override final  int id;
/// 收支方向。
@override final  EntryType type;
/// 人民币元字符串，不通过浮点回填。
@override final  String amount;
/// YYYY-MM-DD 业务自然日期。
@override final  String occurredDate;
/// 一、二级分类历史展示。
@override final  TransactionCategory category;
/// 可选标题。
@override final  String? title;
/// 可选备注。
@override final  String? remark;
/// 当前记录关联的完整标签集合。
 final  List<Tag> _tags;
/// 当前记录关联的完整标签集合。
@override List<Tag> get tags {
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tags);
}


/// Create a copy of TransactionItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TransactionItemCopyWith<_TransactionItem> get copyWith => __$TransactionItemCopyWithImpl<_TransactionItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TransactionItemToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _TransactionItem&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.amount, amount) || other.amount == amount)&&(identical(other.occurredDate, occurredDate) || other.occurredDate == occurredDate)&&(identical(other.category, category) || other.category == category)&&(identical(other.title, title) || other.title == title)&&(identical(other.remark, remark) || other.remark == remark)&&const DeepCollectionEquality().equals(other.tags, _tags));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,type,amount,occurredDate,category,title,remark,const DeepCollectionEquality().hash(_tags));
}

@override
String toString() {
    return 'TransactionItem(id: $id, type: $type, amount: $amount, occurredDate: $occurredDate, category: $category, title: $title, remark: $remark, tags: $tags)';
}


}

/// @nodoc
abstract mixin class _$TransactionItemCopyWith<$Res> implements $TransactionItemCopyWith<$Res> {
  factory _$TransactionItemCopyWith(_TransactionItem value, $Res Function(_TransactionItem) _then) = __$TransactionItemCopyWithImpl;
@override @useResult
$Res call({
 int id, EntryType type, String amount, String occurredDate, TransactionCategory category, String? title, String? remark, List<Tag> tags
});


@override $TransactionCategoryCopyWith<$Res> get category;

}
/// @nodoc
class __$TransactionItemCopyWithImpl<$Res>
    implements _$TransactionItemCopyWith<$Res> {
  __$TransactionItemCopyWithImpl(this._self, this._then);

  final _TransactionItem _self;
  final $Res Function(_TransactionItem) _then;

/// Create a copy of TransactionItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? type = null,Object? amount = null,Object? occurredDate = null,Object? category = null,Object? title = freezed,Object? remark = freezed,Object? tags = null,}) {
  return _then(_TransactionItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as EntryType,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as String,occurredDate: null == occurredDate ? _self.occurredDate : occurredDate // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as TransactionCategory,title: freezed == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String?,remark: freezed == remark ? _self.remark : remark // ignore: cast_nullable_to_non_nullable
as String?,tags: null == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<Tag>,
  ));
}

/// Create a copy of TransactionItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TransactionCategoryCopyWith<$Res> get category {
  
  return $TransactionCategoryCopyWith<$Res>(_self.category, (value) {
    return _then(_self.copyWith(category: value));
  });
}
}


/// @nodoc
mixin _$Totals {

/// 后端支出合计。
 String get expense;/// 后端收入合计。
 String get income;/// 完整周期结余；筛选合计不包含此字段。
 String? get balance;
/// Create a copy of Totals
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TotalsCopyWith<Totals> get copyWith => _$TotalsCopyWithImpl<Totals>(this as Totals, _$identity);

  /// Serializes this Totals to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Totals;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Totals&&(identical(other.expense, _this.expense) || other.expense == _this.expense)&&(identical(other.income, _this.income) || other.income == _this.income)&&(identical(other.balance, _this.balance) || other.balance == _this.balance));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Totals;
  return Object.hash(runtimeType,_this.expense,_this.income,_this.balance);
}

@override
String toString() {
  final _this = this as Totals;
  return 'Totals(expense: ${_this.expense}, income: ${_this.income}, balance: ${_this.balance})';
}


}

/// @nodoc
abstract mixin class $TotalsCopyWith<$Res>  {
  factory $TotalsCopyWith(Totals value, $Res Function(Totals) _then) = _$TotalsCopyWithImpl;
@useResult
$Res call({
 String expense, String income, String? balance
});




}
/// @nodoc
class _$TotalsCopyWithImpl<$Res>
    implements $TotalsCopyWith<$Res> {
  _$TotalsCopyWithImpl(this._self, this._then);

  final Totals _self;
  final $Res Function(Totals) _then;

/// Create a copy of Totals
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? expense = null,Object? income = null,Object? balance = freezed,}) {
  return _then(Totals(
expense: null == expense ? _self.expense : expense // ignore: cast_nullable_to_non_nullable
as String,income: null == income ? _self.income : income // ignore: cast_nullable_to_non_nullable
as String,balance: freezed == balance ? _self.balance : balance // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [Totals].
extension TotalsPatterns on Totals {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Totals value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Totals() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Totals value)  $default,){
final _that = this;
switch (_that) {
case _Totals():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Totals value)?  $default,){
final _that = this;
switch (_that) {
case _Totals() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String expense,  String income,  String? balance)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Totals() when $default != null:
return $default(_that.expense,_that.income,_that.balance);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String expense,  String income,  String? balance)  $default,) {final _that = this;
switch (_that) {
case _Totals():
return $default(_that.expense,_that.income,_that.balance);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String expense,  String income,  String? balance)?  $default,) {final _that = this;
switch (_that) {
case _Totals() when $default != null:
return $default(_that.expense,_that.income,_that.balance);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Totals implements Totals {
  const _Totals({required this.expense, required this.income, this.balance});
  factory _Totals.fromJson(Map<String, dynamic> json) => _$TotalsFromJson(json);

/// 后端支出合计。
@override final  String expense;
/// 后端收入合计。
@override final  String income;
/// 完整周期结余；筛选合计不包含此字段。
@override final  String? balance;

/// Create a copy of Totals
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TotalsCopyWith<_Totals> get copyWith => __$TotalsCopyWithImpl<_Totals>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TotalsToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Totals&&(identical(other.expense, expense) || other.expense == expense)&&(identical(other.income, income) || other.income == income)&&(identical(other.balance, balance) || other.balance == balance));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,expense,income,balance);
}

@override
String toString() {
    return 'Totals(expense: $expense, income: $income, balance: $balance)';
}


}

/// @nodoc
abstract mixin class _$TotalsCopyWith<$Res> implements $TotalsCopyWith<$Res> {
  factory _$TotalsCopyWith(_Totals value, $Res Function(_Totals) _then) = __$TotalsCopyWithImpl;
@override @useResult
$Res call({
 String expense, String income, String? balance
});




}
/// @nodoc
class __$TotalsCopyWithImpl<$Res>
    implements _$TotalsCopyWith<$Res> {
  __$TotalsCopyWithImpl(this._self, this._then);

  final _Totals _self;
  final $Res Function(_Totals) _then;

/// Create a copy of Totals
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? expense = null,Object? income = null,Object? balance = freezed,}) {
  return _then(_Totals(
expense: null == expense ? _self.expense : expense // ignore: cast_nullable_to_non_nullable
as String,income: null == income ? _self.income : income // ignore: cast_nullable_to_non_nullable
as String,balance: freezed == balance ? _self.balance : balance // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$DailyGroup {

/// 本组日期。
 String get date;/// 匹配筛选的当日支出。
 String get expenseTotal;/// 匹配筛选的当日收入。
 String get incomeTotal;/// 返回的全部流水，接口无分页。
 List<TransactionItem> get transactions;
/// Create a copy of DailyGroup
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DailyGroupCopyWith<DailyGroup> get copyWith => _$DailyGroupCopyWithImpl<DailyGroup>(this as DailyGroup, _$identity);

  /// Serializes this DailyGroup to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as DailyGroup;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DailyGroup&&(identical(other.date, _this.date) || other.date == _this.date)&&(identical(other.expenseTotal, _this.expenseTotal) || other.expenseTotal == _this.expenseTotal)&&(identical(other.incomeTotal, _this.incomeTotal) || other.incomeTotal == _this.incomeTotal)&&const DeepCollectionEquality().equals(other.transactions, _this.transactions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as DailyGroup;
  return Object.hash(runtimeType,_this.date,_this.expenseTotal,_this.incomeTotal,const DeepCollectionEquality().hash(_this.transactions));
}

@override
String toString() {
  final _this = this as DailyGroup;
  return 'DailyGroup(date: ${_this.date}, expenseTotal: ${_this.expenseTotal}, incomeTotal: ${_this.incomeTotal}, transactions: ${_this.transactions})';
}


}

/// @nodoc
abstract mixin class $DailyGroupCopyWith<$Res>  {
  factory $DailyGroupCopyWith(DailyGroup value, $Res Function(DailyGroup) _then) = _$DailyGroupCopyWithImpl;
@useResult
$Res call({
 String date, String expenseTotal, String incomeTotal, List<TransactionItem> transactions
});




}
/// @nodoc
class _$DailyGroupCopyWithImpl<$Res>
    implements $DailyGroupCopyWith<$Res> {
  _$DailyGroupCopyWithImpl(this._self, this._then);

  final DailyGroup _self;
  final $Res Function(DailyGroup) _then;

/// Create a copy of DailyGroup
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? date = null,Object? expenseTotal = null,Object? incomeTotal = null,Object? transactions = null,}) {
  return _then(DailyGroup(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,expenseTotal: null == expenseTotal ? _self.expenseTotal : expenseTotal // ignore: cast_nullable_to_non_nullable
as String,incomeTotal: null == incomeTotal ? _self.incomeTotal : incomeTotal // ignore: cast_nullable_to_non_nullable
as String,transactions: null == transactions ? _self.transactions : transactions // ignore: cast_nullable_to_non_nullable
as List<TransactionItem>,
  ));
}

}


/// Adds pattern-matching-related methods to [DailyGroup].
extension DailyGroupPatterns on DailyGroup {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DailyGroup value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DailyGroup() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DailyGroup value)  $default,){
final _that = this;
switch (_that) {
case _DailyGroup():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DailyGroup value)?  $default,){
final _that = this;
switch (_that) {
case _DailyGroup() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String date,  String expenseTotal,  String incomeTotal,  List<TransactionItem> transactions)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DailyGroup() when $default != null:
return $default(_that.date,_that.expenseTotal,_that.incomeTotal,_that.transactions);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String date,  String expenseTotal,  String incomeTotal,  List<TransactionItem> transactions)  $default,) {final _that = this;
switch (_that) {
case _DailyGroup():
return $default(_that.date,_that.expenseTotal,_that.incomeTotal,_that.transactions);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String date,  String expenseTotal,  String incomeTotal,  List<TransactionItem> transactions)?  $default,) {final _that = this;
switch (_that) {
case _DailyGroup() when $default != null:
return $default(_that.date,_that.expenseTotal,_that.incomeTotal,_that.transactions);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DailyGroup implements DailyGroup {
  const _DailyGroup({required this.date, required this.expenseTotal, required this.incomeTotal, required  List<TransactionItem> transactions}): _transactions = transactions;
  factory _DailyGroup.fromJson(Map<String, dynamic> json) => _$DailyGroupFromJson(json);

/// 本组日期。
@override final  String date;
/// 匹配筛选的当日支出。
@override final  String expenseTotal;
/// 匹配筛选的当日收入。
@override final  String incomeTotal;
/// 返回的全部流水，接口无分页。
 final  List<TransactionItem> _transactions;
/// 返回的全部流水，接口无分页。
@override List<TransactionItem> get transactions {
  if (_transactions is EqualUnmodifiableListView) return _transactions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_transactions);
}


/// Create a copy of DailyGroup
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DailyGroupCopyWith<_DailyGroup> get copyWith => __$DailyGroupCopyWithImpl<_DailyGroup>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DailyGroupToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _DailyGroup&&(identical(other.date, date) || other.date == date)&&(identical(other.expenseTotal, expenseTotal) || other.expenseTotal == expenseTotal)&&(identical(other.incomeTotal, incomeTotal) || other.incomeTotal == incomeTotal)&&const DeepCollectionEquality().equals(other.transactions, _transactions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,date,expenseTotal,incomeTotal,const DeepCollectionEquality().hash(_transactions));
}

@override
String toString() {
    return 'DailyGroup(date: $date, expenseTotal: $expenseTotal, incomeTotal: $incomeTotal, transactions: $transactions)';
}


}

/// @nodoc
abstract mixin class _$DailyGroupCopyWith<$Res> implements $DailyGroupCopyWith<$Res> {
  factory _$DailyGroupCopyWith(_DailyGroup value, $Res Function(_DailyGroup) _then) = __$DailyGroupCopyWithImpl;
@override @useResult
$Res call({
 String date, String expenseTotal, String incomeTotal, List<TransactionItem> transactions
});




}
/// @nodoc
class __$DailyGroupCopyWithImpl<$Res>
    implements _$DailyGroupCopyWith<$Res> {
  __$DailyGroupCopyWithImpl(this._self, this._then);

  final _DailyGroup _self;
  final $Res Function(_DailyGroup) _then;

/// Create a copy of DailyGroup
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? date = null,Object? expenseTotal = null,Object? incomeTotal = null,Object? transactions = null,}) {
  return _then(_DailyGroup(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,expenseTotal: null == expenseTotal ? _self.expenseTotal : expenseTotal // ignore: cast_nullable_to_non_nullable
as String,incomeTotal: null == incomeTotal ? _self.incomeTotal : incomeTotal // ignore: cast_nullable_to_non_nullable
as String,transactions: null == transactions ? _self._transactions : transactions // ignore: cast_nullable_to_non_nullable
as List<TransactionItem>,
  ));
}


}


/// @nodoc
mixin _$MonthlyGroup {

/// 年内月份编号。
 int get month;/// 筛选后的本月支出。
 String get expenseTotal;/// 筛选后的本月收入。
 String get incomeTotal;/// 一级 / 二级支出汇总。
 List<Category> get expenseCategories;/// 一级收入汇总。
 List<Category> get incomeCategories;
/// Create a copy of MonthlyGroup
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MonthlyGroupCopyWith<MonthlyGroup> get copyWith => _$MonthlyGroupCopyWithImpl<MonthlyGroup>(this as MonthlyGroup, _$identity);

  /// Serializes this MonthlyGroup to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as MonthlyGroup;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MonthlyGroup&&(identical(other.month, _this.month) || other.month == _this.month)&&(identical(other.expenseTotal, _this.expenseTotal) || other.expenseTotal == _this.expenseTotal)&&(identical(other.incomeTotal, _this.incomeTotal) || other.incomeTotal == _this.incomeTotal)&&const DeepCollectionEquality().equals(other.expenseCategories, _this.expenseCategories)&&const DeepCollectionEquality().equals(other.incomeCategories, _this.incomeCategories));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as MonthlyGroup;
  return Object.hash(runtimeType,_this.month,_this.expenseTotal,_this.incomeTotal,const DeepCollectionEquality().hash(_this.expenseCategories),const DeepCollectionEquality().hash(_this.incomeCategories));
}

@override
String toString() {
  final _this = this as MonthlyGroup;
  return 'MonthlyGroup(month: ${_this.month}, expenseTotal: ${_this.expenseTotal}, incomeTotal: ${_this.incomeTotal}, expenseCategories: ${_this.expenseCategories}, incomeCategories: ${_this.incomeCategories})';
}


}

/// @nodoc
abstract mixin class $MonthlyGroupCopyWith<$Res>  {
  factory $MonthlyGroupCopyWith(MonthlyGroup value, $Res Function(MonthlyGroup) _then) = _$MonthlyGroupCopyWithImpl;
@useResult
$Res call({
 int month, String expenseTotal, String incomeTotal, List<Category> expenseCategories, List<Category> incomeCategories
});




}
/// @nodoc
class _$MonthlyGroupCopyWithImpl<$Res>
    implements $MonthlyGroupCopyWith<$Res> {
  _$MonthlyGroupCopyWithImpl(this._self, this._then);

  final MonthlyGroup _self;
  final $Res Function(MonthlyGroup) _then;

/// Create a copy of MonthlyGroup
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? month = null,Object? expenseTotal = null,Object? incomeTotal = null,Object? expenseCategories = null,Object? incomeCategories = null,}) {
  return _then(MonthlyGroup(
month: null == month ? _self.month : month // ignore: cast_nullable_to_non_nullable
as int,expenseTotal: null == expenseTotal ? _self.expenseTotal : expenseTotal // ignore: cast_nullable_to_non_nullable
as String,incomeTotal: null == incomeTotal ? _self.incomeTotal : incomeTotal // ignore: cast_nullable_to_non_nullable
as String,expenseCategories: null == expenseCategories ? _self.expenseCategories : expenseCategories // ignore: cast_nullable_to_non_nullable
as List<Category>,incomeCategories: null == incomeCategories ? _self.incomeCategories : incomeCategories // ignore: cast_nullable_to_non_nullable
as List<Category>,
  ));
}

}


/// Adds pattern-matching-related methods to [MonthlyGroup].
extension MonthlyGroupPatterns on MonthlyGroup {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MonthlyGroup value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MonthlyGroup() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MonthlyGroup value)  $default,){
final _that = this;
switch (_that) {
case _MonthlyGroup():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MonthlyGroup value)?  $default,){
final _that = this;
switch (_that) {
case _MonthlyGroup() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int month,  String expenseTotal,  String incomeTotal,  List<Category> expenseCategories,  List<Category> incomeCategories)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MonthlyGroup() when $default != null:
return $default(_that.month,_that.expenseTotal,_that.incomeTotal,_that.expenseCategories,_that.incomeCategories);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int month,  String expenseTotal,  String incomeTotal,  List<Category> expenseCategories,  List<Category> incomeCategories)  $default,) {final _that = this;
switch (_that) {
case _MonthlyGroup():
return $default(_that.month,_that.expenseTotal,_that.incomeTotal,_that.expenseCategories,_that.incomeCategories);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int month,  String expenseTotal,  String incomeTotal,  List<Category> expenseCategories,  List<Category> incomeCategories)?  $default,) {final _that = this;
switch (_that) {
case _MonthlyGroup() when $default != null:
return $default(_that.month,_that.expenseTotal,_that.incomeTotal,_that.expenseCategories,_that.incomeCategories);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MonthlyGroup implements MonthlyGroup {
  const _MonthlyGroup({required this.month, required this.expenseTotal, required this.incomeTotal, required  List<Category> expenseCategories, required  List<Category> incomeCategories}): _expenseCategories = expenseCategories,_incomeCategories = incomeCategories;
  factory _MonthlyGroup.fromJson(Map<String, dynamic> json) => _$MonthlyGroupFromJson(json);

/// 年内月份编号。
@override final  int month;
/// 筛选后的本月支出。
@override final  String expenseTotal;
/// 筛选后的本月收入。
@override final  String incomeTotal;
/// 一级 / 二级支出汇总。
 final  List<Category> _expenseCategories;
/// 一级 / 二级支出汇总。
@override List<Category> get expenseCategories {
  if (_expenseCategories is EqualUnmodifiableListView) return _expenseCategories;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_expenseCategories);
}

/// 一级收入汇总。
 final  List<Category> _incomeCategories;
/// 一级收入汇总。
@override List<Category> get incomeCategories {
  if (_incomeCategories is EqualUnmodifiableListView) return _incomeCategories;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_incomeCategories);
}


/// Create a copy of MonthlyGroup
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MonthlyGroupCopyWith<_MonthlyGroup> get copyWith => __$MonthlyGroupCopyWithImpl<_MonthlyGroup>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MonthlyGroupToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _MonthlyGroup&&(identical(other.month, month) || other.month == month)&&(identical(other.expenseTotal, expenseTotal) || other.expenseTotal == expenseTotal)&&(identical(other.incomeTotal, incomeTotal) || other.incomeTotal == incomeTotal)&&const DeepCollectionEquality().equals(other.expenseCategories, _expenseCategories)&&const DeepCollectionEquality().equals(other.incomeCategories, _incomeCategories));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,month,expenseTotal,incomeTotal,const DeepCollectionEquality().hash(_expenseCategories),const DeepCollectionEquality().hash(_incomeCategories));
}

@override
String toString() {
    return 'MonthlyGroup(month: $month, expenseTotal: $expenseTotal, incomeTotal: $incomeTotal, expenseCategories: $expenseCategories, incomeCategories: $incomeCategories)';
}


}

/// @nodoc
abstract mixin class _$MonthlyGroupCopyWith<$Res> implements $MonthlyGroupCopyWith<$Res> {
  factory _$MonthlyGroupCopyWith(_MonthlyGroup value, $Res Function(_MonthlyGroup) _then) = __$MonthlyGroupCopyWithImpl;
@override @useResult
$Res call({
 int month, String expenseTotal, String incomeTotal, List<Category> expenseCategories, List<Category> incomeCategories
});




}
/// @nodoc
class __$MonthlyGroupCopyWithImpl<$Res>
    implements _$MonthlyGroupCopyWith<$Res> {
  __$MonthlyGroupCopyWithImpl(this._self, this._then);

  final _MonthlyGroup _self;
  final $Res Function(_MonthlyGroup) _then;

/// Create a copy of MonthlyGroup
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? month = null,Object? expenseTotal = null,Object? incomeTotal = null,Object? expenseCategories = null,Object? incomeCategories = null,}) {
  return _then(_MonthlyGroup(
month: null == month ? _self.month : month // ignore: cast_nullable_to_non_nullable
as int,expenseTotal: null == expenseTotal ? _self.expenseTotal : expenseTotal // ignore: cast_nullable_to_non_nullable
as String,incomeTotal: null == incomeTotal ? _self.incomeTotal : incomeTotal // ignore: cast_nullable_to_non_nullable
as String,expenseCategories: null == expenseCategories ? _self._expenseCategories : expenseCategories // ignore: cast_nullable_to_non_nullable
as List<Category>,incomeCategories: null == incomeCategories ? _self._incomeCategories : incomeCategories // ignore: cast_nullable_to_non_nullable
as List<Category>,
  ));
}


}


/// @nodoc
mixin _$DailyResult {

/// YYYY-MM 查询上下文。
 String get period;/// 全月收支及结余。
 Totals get totals;/// 当前筛选收支。
 Totals get filterTotals;/// 按返回顺序的日分组。
 List<DailyGroup> get days;
/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DailyResultCopyWith<DailyResult> get copyWith => _$DailyResultCopyWithImpl<DailyResult>(this as DailyResult, _$identity);

  /// Serializes this DailyResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as DailyResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DailyResult&&(identical(other.period, _this.period) || other.period == _this.period)&&(identical(other.totals, _this.totals) || other.totals == _this.totals)&&(identical(other.filterTotals, _this.filterTotals) || other.filterTotals == _this.filterTotals)&&const DeepCollectionEquality().equals(other.days, _this.days));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as DailyResult;
  return Object.hash(runtimeType,_this.period,_this.totals,_this.filterTotals,const DeepCollectionEquality().hash(_this.days));
}

@override
String toString() {
  final _this = this as DailyResult;
  return 'DailyResult(period: ${_this.period}, totals: ${_this.totals}, filterTotals: ${_this.filterTotals}, days: ${_this.days})';
}


}

/// @nodoc
abstract mixin class $DailyResultCopyWith<$Res>  {
  factory $DailyResultCopyWith(DailyResult value, $Res Function(DailyResult) _then) = _$DailyResultCopyWithImpl;
@useResult
$Res call({
 String period, Totals totals, Totals filterTotals, List<DailyGroup> days
});


$TotalsCopyWith<$Res> get totals;$TotalsCopyWith<$Res> get filterTotals;

}
/// @nodoc
class _$DailyResultCopyWithImpl<$Res>
    implements $DailyResultCopyWith<$Res> {
  _$DailyResultCopyWithImpl(this._self, this._then);

  final DailyResult _self;
  final $Res Function(DailyResult) _then;

/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? period = null,Object? totals = null,Object? filterTotals = null,Object? days = null,}) {
  return _then(DailyResult(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,totals: null == totals ? _self.totals : totals // ignore: cast_nullable_to_non_nullable
as Totals,filterTotals: null == filterTotals ? _self.filterTotals : filterTotals // ignore: cast_nullable_to_non_nullable
as Totals,days: null == days ? _self.days : days // ignore: cast_nullable_to_non_nullable
as List<DailyGroup>,
  ));
}
/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get totals {
  
  return $TotalsCopyWith<$Res>(_self.totals, (value) {
    return _then(_self.copyWith(totals: value));
  });
}/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get filterTotals {
  
  return $TotalsCopyWith<$Res>(_self.filterTotals, (value) {
    return _then(_self.copyWith(filterTotals: value));
  });
}
}


/// Adds pattern-matching-related methods to [DailyResult].
extension DailyResultPatterns on DailyResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DailyResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DailyResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DailyResult value)  $default,){
final _that = this;
switch (_that) {
case _DailyResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DailyResult value)?  $default,){
final _that = this;
switch (_that) {
case _DailyResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String period,  Totals totals,  Totals filterTotals,  List<DailyGroup> days)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DailyResult() when $default != null:
return $default(_that.period,_that.totals,_that.filterTotals,_that.days);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String period,  Totals totals,  Totals filterTotals,  List<DailyGroup> days)  $default,) {final _that = this;
switch (_that) {
case _DailyResult():
return $default(_that.period,_that.totals,_that.filterTotals,_that.days);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String period,  Totals totals,  Totals filterTotals,  List<DailyGroup> days)?  $default,) {final _that = this;
switch (_that) {
case _DailyResult() when $default != null:
return $default(_that.period,_that.totals,_that.filterTotals,_that.days);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DailyResult implements DailyResult {
  const _DailyResult({required this.period, required this.totals, required this.filterTotals, required  List<DailyGroup> days}): _days = days;
  factory _DailyResult.fromJson(Map<String, dynamic> json) => _$DailyResultFromJson(json);

/// YYYY-MM 查询上下文。
@override final  String period;
/// 全月收支及结余。
@override final  Totals totals;
/// 当前筛选收支。
@override final  Totals filterTotals;
/// 按返回顺序的日分组。
 final  List<DailyGroup> _days;
/// 按返回顺序的日分组。
@override List<DailyGroup> get days {
  if (_days is EqualUnmodifiableListView) return _days;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_days);
}


/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DailyResultCopyWith<_DailyResult> get copyWith => __$DailyResultCopyWithImpl<_DailyResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DailyResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _DailyResult&&(identical(other.period, period) || other.period == period)&&(identical(other.totals, totals) || other.totals == totals)&&(identical(other.filterTotals, filterTotals) || other.filterTotals == filterTotals)&&const DeepCollectionEquality().equals(other.days, _days));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,period,totals,filterTotals,const DeepCollectionEquality().hash(_days));
}

@override
String toString() {
    return 'DailyResult(period: $period, totals: $totals, filterTotals: $filterTotals, days: $days)';
}


}

/// @nodoc
abstract mixin class _$DailyResultCopyWith<$Res> implements $DailyResultCopyWith<$Res> {
  factory _$DailyResultCopyWith(_DailyResult value, $Res Function(_DailyResult) _then) = __$DailyResultCopyWithImpl;
@override @useResult
$Res call({
 String period, Totals totals, Totals filterTotals, List<DailyGroup> days
});


@override $TotalsCopyWith<$Res> get totals;@override $TotalsCopyWith<$Res> get filterTotals;

}
/// @nodoc
class __$DailyResultCopyWithImpl<$Res>
    implements _$DailyResultCopyWith<$Res> {
  __$DailyResultCopyWithImpl(this._self, this._then);

  final _DailyResult _self;
  final $Res Function(_DailyResult) _then;

/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? period = null,Object? totals = null,Object? filterTotals = null,Object? days = null,}) {
  return _then(_DailyResult(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,totals: null == totals ? _self.totals : totals // ignore: cast_nullable_to_non_nullable
as Totals,filterTotals: null == filterTotals ? _self.filterTotals : filterTotals // ignore: cast_nullable_to_non_nullable
as Totals,days: null == days ? _self._days : days // ignore: cast_nullable_to_non_nullable
as List<DailyGroup>,
  ));
}

/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get totals {
  
  return $TotalsCopyWith<$Res>(_self.totals, (value) {
    return _then(_self.copyWith(totals: value));
  });
}/// Create a copy of DailyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get filterTotals {
  
  return $TotalsCopyWith<$Res>(_self.filterTotals, (value) {
    return _then(_self.copyWith(filterTotals: value));
  });
}
}


/// @nodoc
mixin _$MonthlyResult {

/// YYYY 查询上下文。
 String get period;/// 全年精确收支及结余。
 Totals get totals;/// 筛选后的全年收支。
 Totals get filterTotals;/// 按接口顺序的月汇总。
 List<MonthlyGroup> get months;
/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MonthlyResultCopyWith<MonthlyResult> get copyWith => _$MonthlyResultCopyWithImpl<MonthlyResult>(this as MonthlyResult, _$identity);

  /// Serializes this MonthlyResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as MonthlyResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MonthlyResult&&(identical(other.period, _this.period) || other.period == _this.period)&&(identical(other.totals, _this.totals) || other.totals == _this.totals)&&(identical(other.filterTotals, _this.filterTotals) || other.filterTotals == _this.filterTotals)&&const DeepCollectionEquality().equals(other.months, _this.months));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as MonthlyResult;
  return Object.hash(runtimeType,_this.period,_this.totals,_this.filterTotals,const DeepCollectionEquality().hash(_this.months));
}

@override
String toString() {
  final _this = this as MonthlyResult;
  return 'MonthlyResult(period: ${_this.period}, totals: ${_this.totals}, filterTotals: ${_this.filterTotals}, months: ${_this.months})';
}


}

/// @nodoc
abstract mixin class $MonthlyResultCopyWith<$Res>  {
  factory $MonthlyResultCopyWith(MonthlyResult value, $Res Function(MonthlyResult) _then) = _$MonthlyResultCopyWithImpl;
@useResult
$Res call({
 String period, Totals totals, Totals filterTotals, List<MonthlyGroup> months
});


$TotalsCopyWith<$Res> get totals;$TotalsCopyWith<$Res> get filterTotals;

}
/// @nodoc
class _$MonthlyResultCopyWithImpl<$Res>
    implements $MonthlyResultCopyWith<$Res> {
  _$MonthlyResultCopyWithImpl(this._self, this._then);

  final MonthlyResult _self;
  final $Res Function(MonthlyResult) _then;

/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? period = null,Object? totals = null,Object? filterTotals = null,Object? months = null,}) {
  return _then(MonthlyResult(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,totals: null == totals ? _self.totals : totals // ignore: cast_nullable_to_non_nullable
as Totals,filterTotals: null == filterTotals ? _self.filterTotals : filterTotals // ignore: cast_nullable_to_non_nullable
as Totals,months: null == months ? _self.months : months // ignore: cast_nullable_to_non_nullable
as List<MonthlyGroup>,
  ));
}
/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get totals {
  
  return $TotalsCopyWith<$Res>(_self.totals, (value) {
    return _then(_self.copyWith(totals: value));
  });
}/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get filterTotals {
  
  return $TotalsCopyWith<$Res>(_self.filterTotals, (value) {
    return _then(_self.copyWith(filterTotals: value));
  });
}
}


/// Adds pattern-matching-related methods to [MonthlyResult].
extension MonthlyResultPatterns on MonthlyResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MonthlyResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MonthlyResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MonthlyResult value)  $default,){
final _that = this;
switch (_that) {
case _MonthlyResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MonthlyResult value)?  $default,){
final _that = this;
switch (_that) {
case _MonthlyResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String period,  Totals totals,  Totals filterTotals,  List<MonthlyGroup> months)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MonthlyResult() when $default != null:
return $default(_that.period,_that.totals,_that.filterTotals,_that.months);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String period,  Totals totals,  Totals filterTotals,  List<MonthlyGroup> months)  $default,) {final _that = this;
switch (_that) {
case _MonthlyResult():
return $default(_that.period,_that.totals,_that.filterTotals,_that.months);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String period,  Totals totals,  Totals filterTotals,  List<MonthlyGroup> months)?  $default,) {final _that = this;
switch (_that) {
case _MonthlyResult() when $default != null:
return $default(_that.period,_that.totals,_that.filterTotals,_that.months);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MonthlyResult implements MonthlyResult {
  const _MonthlyResult({required this.period, required this.totals, required this.filterTotals, required  List<MonthlyGroup> months}): _months = months;
  factory _MonthlyResult.fromJson(Map<String, dynamic> json) => _$MonthlyResultFromJson(json);

/// YYYY 查询上下文。
@override final  String period;
/// 全年精确收支及结余。
@override final  Totals totals;
/// 筛选后的全年收支。
@override final  Totals filterTotals;
/// 按接口顺序的月汇总。
 final  List<MonthlyGroup> _months;
/// 按接口顺序的月汇总。
@override List<MonthlyGroup> get months {
  if (_months is EqualUnmodifiableListView) return _months;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_months);
}


/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MonthlyResultCopyWith<_MonthlyResult> get copyWith => __$MonthlyResultCopyWithImpl<_MonthlyResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MonthlyResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _MonthlyResult&&(identical(other.period, period) || other.period == period)&&(identical(other.totals, totals) || other.totals == totals)&&(identical(other.filterTotals, filterTotals) || other.filterTotals == filterTotals)&&const DeepCollectionEquality().equals(other.months, _months));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,period,totals,filterTotals,const DeepCollectionEquality().hash(_months));
}

@override
String toString() {
    return 'MonthlyResult(period: $period, totals: $totals, filterTotals: $filterTotals, months: $months)';
}


}

/// @nodoc
abstract mixin class _$MonthlyResultCopyWith<$Res> implements $MonthlyResultCopyWith<$Res> {
  factory _$MonthlyResultCopyWith(_MonthlyResult value, $Res Function(_MonthlyResult) _then) = __$MonthlyResultCopyWithImpl;
@override @useResult
$Res call({
 String period, Totals totals, Totals filterTotals, List<MonthlyGroup> months
});


@override $TotalsCopyWith<$Res> get totals;@override $TotalsCopyWith<$Res> get filterTotals;

}
/// @nodoc
class __$MonthlyResultCopyWithImpl<$Res>
    implements _$MonthlyResultCopyWith<$Res> {
  __$MonthlyResultCopyWithImpl(this._self, this._then);

  final _MonthlyResult _self;
  final $Res Function(_MonthlyResult) _then;

/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? period = null,Object? totals = null,Object? filterTotals = null,Object? months = null,}) {
  return _then(_MonthlyResult(
period: null == period ? _self.period : period // ignore: cast_nullable_to_non_nullable
as String,totals: null == totals ? _self.totals : totals // ignore: cast_nullable_to_non_nullable
as Totals,filterTotals: null == filterTotals ? _self.filterTotals : filterTotals // ignore: cast_nullable_to_non_nullable
as Totals,months: null == months ? _self._months : months // ignore: cast_nullable_to_non_nullable
as List<MonthlyGroup>,
  ));
}

/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get totals {
  
  return $TotalsCopyWith<$Res>(_self.totals, (value) {
    return _then(_self.copyWith(totals: value));
  });
}/// Create a copy of MonthlyResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TotalsCopyWith<$Res> get filterTotals {
  
  return $TotalsCopyWith<$Res>(_self.filterTotals, (value) {
    return _then(_self.copyWith(filterTotals: value));
  });
}
}

// dart format on
