import 'package:flutter/material.dart';

/// 延续 Web 品牌黄色，统一浅深 Material 3 主题。
abstract final class AppTheme {
  /// tokens.css 的品牌颜色。
  static const brand = Color(0xffffe639);

  /// 构建 [brightness] 的语义配色、表单和移动按钮尺寸。
  static ThemeData create(Brightness brightness) {
    // Material 生成对比可读的浅深主题语义色。
    final scheme = ColorScheme.fromSeed(
      seedColor: brand,
      brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      scaffoldBackgroundColor: brightness == Brightness.light
          ? const Color(0xfff4f5f7)
          : scheme.surface,
      appBarTheme: const AppBarTheme(centerTitle: false),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.all(16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: brand,
        foregroundColor: Color(0xff202124),
      ),
    );
  }
}
