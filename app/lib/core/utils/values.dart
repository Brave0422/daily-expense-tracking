/// 精确解析人民币元字符串。[amount] 不含货币符号；返回整数分。
/// 格式不符合最多十三位整数、两位小数时抛出 FormatException。
int yuanToCents(String amount) {
  // 完整匹配防止末尾换行和指数形式被错误接受。
  final match = RegExp(r'^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$')
      .firstMatch(amount);
  if (match == null || match.group(0) != amount) {
    throw const FormatException('金额最多13位整数和2位小数');
  }
  // 分离元与小数，整个业务换算不经过 double。
  final parts = amount.split('.');
  return int.parse(parts[0]) * 100 +
      int.parse((parts.length == 2 ? parts[1] : '0').padRight(2, '0'));
}

/// 格式化服务端金额。[amount] 可含负号；返回带人民币符号的两位小数文案。
String money(String amount) {
  // 负号仅用于显示结余，不参与录入接口。
  final negative = amount.startsWith('-');
  // 服务端统计可能超过单笔上限，显示只补小数，不按单笔格式解析。
  final parts = (negative ? amount.substring(1) : amount).split('.');
  return '${negative ? '-' : ''}¥${parts.first}.${(parts.length > 1 ? parts[1] : '0').padRight(2, '0')}';
}

/// 校验金额。[text] 为输入元字符串；[positive] 决定是否允许零，返回字段错误或 null。
String? validateAmount(String? text, {bool positive = true}) {
  try {
    if (yuanToCents(text ?? '') == 0 && positive) {
      return '金额必须大于0';
    }
    return null;
  } on FormatException catch (_) {
    // 格式错误只影响当前字段，不清空其他草稿。
    return '请输入有效金额，最多13位整数和2位小数';
  }
}

/// 按后端 Unicode 码点计数。[text] 为原始文本；返回字符数量，包括单个 emoji。
int textLength(String text) => text.runes.length;

/// 校验文本。[text] trim 后验证；[limit] 为后端码点上限；[required] 表示不可留空。
String? validateText(String? text, int limit, {bool required = false}) {
  // 与 class-validator 的字符计数和后端 trim 保持一致。
  final value = (text ?? '').trim();
  if (required && value.isEmpty) {
    return '不能为空';
  }
  return textLength(value) > limit ? '最多$limit个字符' : null;
}

/// 序列化自然日期。[date] 使用本地年月日；返回 YYYY-MM-DD，不转换 UTC。
String naturalDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

/// 返回自然月份。[date] 为本地日期，结果为 YYYY-MM。
String naturalMonth(DateTime date) => naturalDate(date).substring(0, 7);

/// 严格解析自然日期。[value] 为 YYYY-MM-DD；拒绝自动滚动的非法月日。
DateTime parseNaturalDate(String value) {
  // 校验格式后再检查构造器规范化是否改变输入。
  final match = RegExp(r'^[1-9]\d{3}-\d{2}-\d{2}$').firstMatch(value);
  if (match == null || match.group(0) != value) {
    throw const FormatException('日期格式不正确');
  }
  // 保留自然年月日，避免时区跨天。
  final date = DateTime(
    int.parse(value.substring(0, 4)),
    int.parse(value.substring(5, 7)),
    int.parse(value.substring(8)),
  );
  if (naturalDate(date) != value) {
    throw const FormatException('日期不存在');
  }
  return date;
}
