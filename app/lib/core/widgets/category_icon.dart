import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'category_icon_keys.dart';

/// 用服务端颜色绘制背景，本地 SVG 只提供中心图案。
class CategoryIcon extends StatelessWidget {
  /// [iconKey] 为资源键；[color] 为最终背景色；[size] 为逻辑像素；[key] 为组件标识。
  const CategoryIcon({
    super.key,
    required this.iconKey,
    required this.color,
    this.size = 40,
  });

  /// 服务端图标键，未知键使用占位。
  final String iconKey;

  /// 服务端最终背景颜色。
  final String color;

  /// 圆形图标直径。
  final double size;

  /// 构建资源图标。[context] 提供默认主题色。
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Color(
          int.tryParse(color.replaceFirst('#', 'ff'), radix: 16) ?? 0xff70737a,
        ),
      ),
      child: categoryIconKeys.contains(iconKey)
          ? SvgPicture.asset(
              'assets/icons/categories/${iconKey.substring(5)}.svg',
              width: size,
              height: size,
              // [context] 为资源组件；[error] 与 [stack] 仅提供占位，不影响金额。
              errorBuilder: (context, error, stack) =>
                  const Icon(Icons.category, color: Colors.white),
            )
          : const Icon(Icons.category, color: Colors.white),
    ),
  );
}
