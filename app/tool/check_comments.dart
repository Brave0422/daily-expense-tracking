import 'dart:io';

import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/ast/token.dart';
import 'package:analyzer/dart/analysis/utilities.dart';

/// 检查手写 Dart 声明的中文注释；生成文件跳过，注释语义仍需人工复查。
void main() {
  // 当前工程所有检查目标目录。
  final roots = ['lib', 'test', 'integration_test', 'tool'];
  // 累计未覆盖的声明诊断。
  var count = 0;
  // 每个 [root] 是一个实际存在的源码目录，缺失目录不伪造检查。
  for (final root in roots) {
    if (!Directory(root).existsSync()) {
      continue;
    }
    // 每个 [entity] 为递归文件，过滤生成器输出。
    for (final entity in Directory(root).listSync(recursive: true)) {
      if (entity is! File ||
          !entity.path.endsWith('.dart') ||
          entity.path.endsWith('.g.dart') ||
          entity.path.endsWith('.freezed.dart')) {
        continue;
      }
      // 本文件完整源码，用于 AST 和行号定位。
      final content = entity.readAsStringSync();
      // 无需类型解析即可审计局部变量和命名声明。
      final parsed = parseString(content: content, path: entity.path);
      // 按文件记录缺失声明，诊断不会打印源数据或凭证。
      final visitor = CommentVisitor(content, entity.path);
      parsed.unit.accept(visitor);
      count += visitor.failures;
    }
  }
  stdout.writeln('注释声明检查：$count 项缺失；需另外复核注释准确性及关键流程。');
  exitCode = count == 0 ? 0 : 1;
}

/// 检查局部声明及具名方法 / 构造器的紧邻注释。
class CommentVisitor extends RecursiveAstVisitor<void> {
  /// [content] 用于定位行号；[path] 用于输出诊断。
  CommentVisitor(this.content, this.path);

  /// 本文件源码，仅用于本地检查。
  final String content;

  /// 相对源码路径，不含请求凭证。
  final String path;

  /// 当前文件未覆盖声明数量。
  int failures = 0;

  /// 读取 [node] 紧邻注释或少量声明包装层的注释，不接受远处方法文档代替局部解释。
  bool _commented(AstNode node, {int wrappers = 2}) {
    // 当前检查节点，每次仅向外查一层包装。
    AstNode? current = node;
    // [i] 限制包装层深度，避免误把整个类的文档当成局部注释。
    for (var i = 0; i <= wrappers && current != null; i++) {
      if (current is AnnotatedNode &&
          current.documentationComment != null &&
          current.documentationComment!.tokens.any(
            (token) => RegExp(r'[\u4e00-\u9fff]').hasMatch(token.lexeme),
          )) {
        return true;
      }
      // 当前声明前的所有注释 token。
      Token? comment = current.beginToken.precedingComments;
      while (comment != null) {
        if (RegExp(r'[\u4e00-\u9fff]').hasMatch(comment.lexeme)) {
          return true;
        }
        comment = comment.next;
      }
      current = current.parent;
    }
    return false;
  }

  /// 输出 [node] 的 [description] 缺失诊断。
  void _check(AstNode node, String description, {int wrappers = 2}) {
    if (_commented(node, wrappers: wrappers)) {
      return;
    }
    failures++;
    // 声明所在的一基行号。
    final line = '\n'.allMatches(content.substring(0, node.offset)).length + 1;
    stdout.writeln('$path:$line 缺少中文注释：$description');
  }

  /// 检查 [node] 的字段、常量或局部变量。
  @override
  void visitVariableDeclaration(VariableDeclaration node) {
    _check(node, node.name.lexeme, wrappers: 3);
    super.visitVariableDeclaration(node);
  }

  /// 检查 [node] 的构造方法。
  @override
  void visitConstructorDeclaration(ConstructorDeclaration node) {
    _check(node, '构造器', wrappers: 0);
    super.visitConstructorDeclaration(node);
  }

  /// 检查 [node] 的生命周期、getter 和业务方法。
  @override
  void visitMethodDeclaration(MethodDeclaration node) {
    _check(node, node.name.lexeme, wrappers: 0);
    super.visitMethodDeclaration(node);
  }

  /// 检查 [node] 的顶层 / 局部具名函数。
  @override
  void visitFunctionDeclaration(FunctionDeclaration node) {
    _check(node, node.name.lexeme, wrappers: 0);
    super.visitFunctionDeclaration(node);
  }
}
