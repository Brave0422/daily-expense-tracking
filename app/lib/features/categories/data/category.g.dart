// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'category.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Category _$CategoryFromJson(Map<String, dynamic> json) => _Category(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  iconKey: json['iconKey'] as String,
  backgroundColor: json['backgroundColor'] as String,
  archived: json['archived'] as bool? ?? false,
  type: $enumDecodeNullable(_$EntryTypeEnumMap, json['type']),
  level: (json['level'] as num?)?.toInt(),
  parentId: (json['parentId'] as num?)?.toInt(),
  sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
  isDefault: json['isDefault'] as bool? ?? false,
  children:
      (json['children'] as List<dynamic>?)
          ?.map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  amount: json['amount'] as String?,
);

Map<String, dynamic> _$CategoryToJson(_Category instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'iconKey': instance.iconKey,
  'backgroundColor': instance.backgroundColor,
  'archived': instance.archived,
  'type': _$EntryTypeEnumMap[instance.type],
  'level': instance.level,
  'parentId': instance.parentId,
  'sortOrder': instance.sortOrder,
  'isDefault': instance.isDefault,
  'children': instance.children,
  'amount': instance.amount,
};

const _$EntryTypeEnumMap = {
  EntryType.expense: 'expense',
  EntryType.income: 'income',
};

_CategoryIconOption _$CategoryIconOptionFromJson(Map<String, dynamic> json) =>
    _CategoryIconOption(
      iconKey: json['iconKey'] as String,
      backgroundColor: json['backgroundColor'] as String,
    );

Map<String, dynamic> _$CategoryIconOptionToJson(_CategoryIconOption instance) =>
    <String, dynamic>{
      'iconKey': instance.iconKey,
      'backgroundColor': instance.backgroundColor,
    };
