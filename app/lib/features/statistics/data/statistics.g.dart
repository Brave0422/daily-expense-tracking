// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'statistics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_StatisticsParent _$StatisticsParentFromJson(Map<String, dynamic> json) =>
    _StatisticsParent(
      categoryId: (json['categoryId'] as num).toInt(),
      name: json['name'] as String,
    );

Map<String, dynamic> _$StatisticsParentToJson(_StatisticsParent instance) =>
    <String, dynamic>{'categoryId': instance.categoryId, 'name': instance.name};

_StatisticsItem _$StatisticsItemFromJson(Map<String, dynamic> json) =>
    _StatisticsItem(
      categoryId: (json['categoryId'] as num).toInt(),
      name: json['name'] as String,
      iconKey: json['iconKey'] as String,
      backgroundColor: json['backgroundColor'] as String,
      amount: json['amount'] as String,
      percentage: json['percentage'] as String,
      parent: json['parent'] == null
          ? null
          : StatisticsParent.fromJson(json['parent'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$StatisticsItemToJson(_StatisticsItem instance) =>
    <String, dynamic>{
      'categoryId': instance.categoryId,
      'name': instance.name,
      'iconKey': instance.iconKey,
      'backgroundColor': instance.backgroundColor,
      'amount': instance.amount,
      'percentage': instance.percentage,
      'parent': instance.parent,
    };

_TrendPoint _$TrendPointFromJson(Map<String, dynamic> json) =>
    _TrendPoint(date: json['date'] as String, amount: json['amount'] as String);

Map<String, dynamic> _$TrendPointToJson(_TrendPoint instance) =>
    <String, dynamic>{'date': instance.date, 'amount': instance.amount};

_StatisticsResult _$StatisticsResultFromJson(Map<String, dynamic> json) =>
    _StatisticsResult(
      period: json['period'] as String,
      periodType: json['periodType'] as String,
      type: json['type'] as String,
      transactionCount: (json['transactionCount'] as num).toInt(),
      totalAmount: json['totalAmount'] as String,
      categoryLevel: (json['categoryLevel'] as num?)?.toInt(),
      order: json['order'] as String?,
      items: (json['items'] as List<dynamic>?)
          ?.map((e) => StatisticsItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      previousPeriod: json['previousPeriod'] as String?,
      previousTotalAmount: json['previousTotalAmount'] as String?,
      changeRate: json['changeRate'] as String?,
      changeStatus: json['changeStatus'] as String?,
      series: (json['series'] as List<dynamic>?)
          ?.map((e) => TrendPoint.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$StatisticsResultToJson(_StatisticsResult instance) =>
    <String, dynamic>{
      'period': instance.period,
      'periodType': instance.periodType,
      'type': instance.type,
      'transactionCount': instance.transactionCount,
      'totalAmount': instance.totalAmount,
      'categoryLevel': instance.categoryLevel,
      'order': instance.order,
      'items': instance.items,
      'previousPeriod': instance.previousPeriod,
      'previousTotalAmount': instance.previousTotalAmount,
      'changeRate': instance.changeRate,
      'changeStatus': instance.changeStatus,
      'series': instance.series,
    };
