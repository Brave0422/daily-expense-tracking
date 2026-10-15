"""跨平台静态检查；不能替代Xcode类型检查、构建或设备验收。"""
import ast
import json
import plistlib
import re
import sys
from pathlib import Path
from xml.etree import ElementTree
from openstep_parser import OpenStepDecoder
from pypdf import PdfReader
from tree_sitter import Language, Parser
import tree_sitter_swift

# 当前工程目录。
ROOT = Path(__file__).resolve().parents[1]
# 当前Swift语法解析器，无Apple SDK语义检查能力。
PARSER = Parser(Language(tree_sitter_swift.language()))
# 静态失败集合。
ERRORS = []


def check(condition, message):
    """condition为必须成立的断言；失败时记录message并继续其余独立检查。"""
    if not condition:
        ERRORS.append(message)


def visit(node):
    """node为语法树节点；递归返回所有节点供语法和注释审阅。"""
    yield node
    # child为每个语法子节点。
    for child in node.children:
        yield from visit(child)


def main():
    """检查源码语法、工程引用、资源和环境隔离；输出真实静态证据。"""
    # 正式源码与测试全部进入扫描。
    sources = sorted(path for directory in ["DailyExpenseTracking", "DailyExpenseTrackingTests", "DailyExpenseTrackingUITests"] for path in (ROOT / directory).rglob("*.swift"))
    # 未见相邻中文注释的声明，供人工复核，不能用数量代替语义验收。
    comment_review = []
    # path为每个自有Swift文件。
    for path in sources:
        # 当前源码字节，语法树按字节定位。
        source = path.read_bytes()
        # 当前语法树。
        tree = PARSER.parse(source)
        # 当前文本行。
        lines = source.decode("utf-8").splitlines()
        # node为完整语法树的每个节点。
        for node in visit(tree.root_node):
            if node.type == "ERROR" or node.is_missing:
                ERRORS.append(f"Swift语法：{path.relative_to(ROOT)}:{node.start_point.row + 1} {source[node.start_byte:node.end_byte].decode('utf-8')[:90]}")
            if node.type in {"property_declaration", "function_declaration", "init_declaration"}:
                # 声明前三行的注释上下文；嵌在有说明的闭包/方法内声明需人工核对。
                context = "\n".join(lines[max(0, node.start_point.row - 3):node.start_point.row + 1])
                if not re.search(r"//[^\n]*[\u4e00-\u9fff]", context):
                    comment_review.append(f"{path.relative_to(ROOT)}:{node.start_point.row + 1}")
        check("try!" not in source.decode("utf-8") and "fatalError(" not in source.decode("utf-8"), f"不安全强制失败：{path.name}")
    # 自有辅助脚本也做Python语法检查，不执行其写操作。
    scripts = list((ROOT / "tools").glob("*.py"))
    # path为每个自有脚本。
    for path in scripts:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    # OpenStep解析后的Xcode工程根对象。
    project = OpenStepDecoder.ParseFromString((ROOT / "DailyExpenseTracking.xcodeproj/project.pbxproj").read_text(encoding="utf-8"))
    # 目标、文件和配置共用的对象表。
    objects = project["objects"]
    check(project["rootObject"] in objects, "工程根对象不存在")
    # reference为每个PBX对象，检查所有显式文件路径。
    for reference in objects.values():
        if reference.get("isa") == "PBXFileReference" and reference.get("sourceTree") == "SOURCE_ROOT":
            check((ROOT / reference["path"]).exists(), "工程缺失文件：" + reference["path"])
    # 所有编译源文件引用。
    referenced_sources = {reference["path"] for reference in objects.values() if reference.get("lastKnownFileType") == "sourcecode.swift"}
    check(referenced_sources == {path.relative_to(ROOT).as_posix() for path in sources}, "有Swift源未加入Xcode工程")
    # 共享方案XML必须可解析并引用当前工程中的目标。
    scheme = ElementTree.parse(ROOT / "DailyExpenseTracking.xcodeproj/xcshareddata/xcschemes/DailyExpenseTracking.xcscheme")
    # node为方案中的每个产品目标引用。
    for node in scheme.iter("BuildableReference"):
        check(node.attrib["BlueprintIdentifier"] in objects, "共享方案目标丢失")
    # Release绝不能包含开发ATS例外。
    release = plistlib.loads((ROOT / "Config/Info-Release.plist").read_bytes())
    check("NSAppTransportSecurity" not in release, "Release不应有ATS例外")
    check("Local.xcconfig" not in (ROOT / "Config/Release.xcconfig").read_text(encoding="utf-8"), "Release不能读取本机HTTP覆盖")
    # 服务端真实图标键集合。
    keys = set(re.findall(r"'((?:icon-)[^']+)'", (ROOT.parent / "service-nest/src/modules/categories/enums/icon-key-enum.ts").read_text(encoding="utf-8")))
    # 原生资源映射。
    mapping = json.loads((ROOT / "DailyExpenseTracking/Resources/CategoryIconMapping.json").read_text(encoding="utf-8"))
    check(set(mapping) == keys, "图标映射未覆盖当前服务端键集合")
    # key为真实图标键，record为源到输出映射。
    for key, record in mapping.items():
        # PDF矢量图案路径。
        pdf = ROOT / "DailyExpenseTracking/Resources/Assets.xcassets" / record["asset"]
        # 已解析的单页PDF，确保没有空壳文件。
        reader = PdfReader(pdf)
        check(len(reader.pages) == 1 and len(reader.pages[0].get_contents().get_data()) > 30, "空图案：" + key)
    # 资源JSON全部应能解码。
    catalogs = list((ROOT / "DailyExpenseTracking/Resources").rglob("*.json")) + list((ROOT / "DailyExpenseTracking/Resources").glob("*.xcstrings"))
    # path为每个资源清单。
    for path in catalogs:
        json.loads(path.read_text(encoding="utf-8"))
    # 生成静态报告，未能在Windows执行的检查显式写出。
    report = {"swift_files": len(sources), "python_files": len(scripts), "icon_keys": len(keys), "project_targets": len([value for value in objects.values() if value.get("isa") == "PBXNativeTarget"]), "syntax_errors": ERRORS, "comment_review_locations": comment_review, "not_run": ["Xcode编译与类型检查", "XCTest/XCUITest", "iOS模拟器与真机", "真实后端闭环", "设备视觉及无障碍"]}
    # 仅静态报告写入artifacts，不包含业务或凭证数据。
    destination = ROOT / "artifacts/static-check.json"
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
