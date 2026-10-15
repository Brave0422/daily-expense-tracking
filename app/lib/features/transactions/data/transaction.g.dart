// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'transaction.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_TransactionCategory _$TransactionCategoryFromJson(Map<String, dynamic> json) =>
    _TransactionCategory(
      primary: Category.fromJson(json['primary'] as Map<String, dynamic>),
      secondary: json['secondary'] == null
          ? null
          : Category.fromJson(json['secondary'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$TransactionCategoryToJson(
  _TransactionCategory instance,
) => <String, dynamic>{
  'primary': instance.primary,
  'secondary': instance.secondary,
};

_TransactionItem _$TransactionItemFromJson(Map<String, dynamic> json) =>
    _TransactionItem(
      id: (json['id'] as num).toInt(),
      type: $enumDecode(_$EntryTypeEnumMap, json['type']),
      amount: json['amount'] as String,
      occurredDate: json['occurredDate'] as String,
      category: TransactionCategory.fromJson(
        json['category'] as Map<String, dynamic>,
      ),
      title: json['title'] as String?,
      remark: json['remark'] as String?,
      tags: (json['tags'] as List<dynamic>)
          .map((e) => Tag.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$TransactionItemToJson(_TransactionItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': _$EntryTypeEnumMap[instance.type]!,
      'amount': instance.amount,
      'occurredDate': instance.occurredDate,
      'category': instance.category,
      'title': instance.title,
      'remark': instance.remark,
      'tags': instance.tags,
    };

const _$EntryTypeEnumMap = {
  EntryType.expense: 'expense',
  EntryType.income: 'income',
};

_Totals _$TotalsFromJson(Map<String, dynamic> json) => _Totals(
  expense: json['expense'] as String,
  income: json['income'] as String,
  balance: json['balance'] as String?,
);

Map<String, dynamic> _$TotalsToJson(_Totals instance) => <String, dynamic>{
  'expense': instance.expense,
  'income': instance.income,
  'balance': instance.balance,
};

_DailyGroup _$DailyGroupFromJson(Map<String, dynamic> json) => _DailyGroup(
  date: json['date'] as String,
  expenseTotal: json['expenseTotal'] as String,
  incomeTotal: json['incomeTotal'] as String,
  transactions: (json['transactions'] as List<dynamic>)
      .map((e) => TransactionItem.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$DailyGroupToJson(_DailyGroup instance) =>
    <String, dynamic>{
      'date': instance.date,
      'expenseTotal': instance.expenseTotal,
      'incomeTotal': instance.incomeTotal,
      'transactions': instance.transactions,
    };

_MonthlyGroup _$MonthlyGroupFromJson(Map<String, dynamic> json) =>
    _MonthlyGroup(
      month: (json['month'] as num).toInt(),
      expenseTotal: json['expenseTotal'] as String,
      incomeTotal: json['incomeTotal'] as String,
      expenseCategories: (json['expenseCategories'] as List<dynamic>)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList(),
      incomeCategories: (json['incomeCategories'] as List<dynamic>)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$MonthlyGroupToJson(_MonthlyGroup instance) =>
    <String, dynamic>{
      'month': instance.month,
      'expenseTotal': instance.expenseTotal,
      'incomeTotal': instance.incomeTotal,
      'expenseCategories': instance.expenseCategories,
      'incomeCategories': instance.incomeCategories,
    };

_DailyResult _$DailyResultFromJson(Map<String, dynamic> json) => _DailyResult(
  period: json['period'] as String,
  totals: Totals.fromJson(json['totals'] as Map<String, dynamic>),
  filterTotals: Totals.fromJson(json['filterTotals'] as Map<String, dynamic>),
  days: (json['days'] as List<dynamic>)
      .map((e) => DailyGroup.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$DailyResultToJson(_DailyResult instance) =>
    <String, dynamic>{
      'period': instance.period,
      'totals': instance.totals,
      'filterTotals': instance.filterTotals,
      'days': instance.days,
    };

_MonthlyResult _$MonthlyResultFromJson(Map<String, dynamic> json) =>
    _MonthlyResult(
      period: json['period'] as String,
      totals: Totals.fromJson(json['totals'] as Map<String, dynamic>),
      filterTotals: Totals.fromJson(
        json['filterTotals'] as Map<String, dynamic>,
      ),
      months: (json['months'] as List<dynamic>)
          .map((e) => MonthlyGroup.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$MonthlyResultToJson(_MonthlyResult instance) =>
    <String, dynamic>{
      'period': instance.period,
      'totals': instance.totals,
      'filterTotals': instance.filterTotals,
      'months': instance.months,
    };
