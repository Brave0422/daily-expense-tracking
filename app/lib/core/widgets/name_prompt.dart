import 'package:flutter/material.dart';

import '../utils/values.dart';

/// 请求本地名称草稿。[context] 为页面；[title] 为用途；[initial] 为原值；
/// [hint] 为影响范围说明。返回名称或 null，不进行任何服务写入。
Future<String?> promptName(
  BuildContext context,
  String title, {
  String initial = '',
  String? hint,
}) async {
  // 输入控制器只存活于弹窗生命周期。
  final input = TextEditingController(text: initial);
  // 名称校验键，按后端 50 个 Unicode 码点限制。
  final form = GlobalKey<FormState>();
  try {
    return await showDialog<String>(
      context: context,
      // [dialogContext] 仅用于本次对话框关闭。
      builder: (dialogContext) => AlertDialog(
        scrollable: true,
        title: Text(title),
        content: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (hint != null) Text(hint),
              TextFormField(
                controller: input,
                autofocus: true,
                decoration: const InputDecoration(labelText: '标签名称'),
                // [text] 为名称输入，统一 trim 并校验码点。
                validator: (text) => validateText(text, 50, required: true),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              if (form.currentState!.validate()) {
                Navigator.pop(dialogContext, input.text.trim());
              }
            },
            child: const Text('确认'),
          ),
        ],
      ),
    );
  } finally {
    // 对话框退出动画仍会读取 Controller，下一帧之后延迟到动画完成释放。
    await Future<void>.delayed(const Duration(milliseconds: 300));
    input.dispose();
  }
}
