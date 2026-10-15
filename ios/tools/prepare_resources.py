"""转换已有Web矢量图案、生成主题资源；不引入新的图标设计或远程资源。"""
import io
import json
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF
from reportlab import rl_config

# 固定PDF元数据和标识，重跑资源生成时不产生无意义二进制差异。
rl_config.invariant = True

# 当前脚本所属ios工程根目录。
ROOT = Path(__file__).resolve().parents[1]
# 现有Web图标目录，仅只读。
SOURCE = ROOT.parent / "web/src/assets/icons/categories"
# 原生Asset Catalog目标。
ASSETS = ROOT / "DailyExpenseTracking/Resources/Assets.xcassets"
# 独立资源作者信息。
INFO = {"author": "xcode", "version": 1}


def write_json(path, value):
    """写UTF-8 JSON；path为输出路径，value为可序列化资源元数据。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def convert_icons():
    """按当前服务端键集合转换中心图案，保留每个源文件映射和许可。"""
    # 后端当前真正接受的图标键集合，避免使用过期文档数量。
    keys = set(re.findall(r"'((?:icon-)[^']+)'", (ROOT.parent / "service-nest/src/modules/categories/enums/icon-key-enum.ts").read_text(encoding="utf-8")))
    # 写入实施记录的源键到矢量资源映射。
    mapping = {}
    # key为每个真实iconKey；只在ios输出，不改变Web源图。
    for key in sorted(keys):
        # 去掉协议前缀得到Web文件名。
        filename = key.removeprefix("icon-") + ".svg"
        # 排除预览合图，按唯一文件名查找源图。
        candidates = [path for path in SOURCE.rglob(filename) if "preview" not in path.parts]
        if len(candidates) != 1:
            raise ValueError(f"图标源必须唯一：{key}")
        # 当前图标源的XML树。
        tree = ET.fromstring(candidates[0].read_bytes())
        # child是根SVG直接子节点；删除圆背景和无关title，保留原中心白图形。
        for child in list(tree):
            if child.tag.endswith("title") or "var(--category-icon-background" in child.attrib.get("fill", ""):
                tree.remove(child)
        # 序列化为独立白色中心SVG，保留原viewBox和变换。
        svg = ET.tostring(tree)
        # svglib返回可缩放矢量绘图对象，不栅格化。
        drawing = svg2rlg(io.BytesIO(svg))
        if drawing is None:
            raise ValueError(f"无法转换图案：{key}")
        # 单图资源目录。
        destination = ASSETS / f"{key}.imageset"
        destination.mkdir(parents=True, exist_ok=True)
        renderPDF.drawToFile(drawing, str(destination / "glyph.pdf"))
        write_json(destination / "Contents.json", {"images": [{"filename": "glyph.pdf", "idiom": "universal"}], "info": INFO, "properties": {"preserves-vector-representation": True}})
        mapping[key] = {"source": candidates[0].relative_to(ROOT.parent).as_posix(), "asset": f"{key}.imageset/glyph.pdf"}
    write_json(ROOT / "DailyExpenseTracking/Resources/CategoryIconMapping.json", mapping)
    shutil.copyfile(SOURCE / "THIRD_PARTY_NOTICES.md", ROOT / "DailyExpenseTracking/Resources/THIRD_PARTY_NOTICES.md")
    print(f"已转换{len(mapping)}个中心矢量图案，背景由SwiftUI绘制")


def prepare_theme():
    """生成PRD规定的浅深主题语义色，不在业务页散落色值。"""
    # 每个名称对应浅色与深色十六进制值；小字收支采用规范允许的深色变体。
    colors = {"Primary": ("FFE639", "FFE639"), "PrimarySoft": ("FFF9CC", "383319"), "Page": ("F4F5F7", "111214"), "Surface": ("FFFFFF", "1C1D20"), "TextPrimary": ("202124", "F3F4F6"), "TextSecondary": ("70737A", "A9ADB6"), "Border": ("E6E8EC", "383B42"), "Expense": ("177548", "45C58A"), "Income": ("BA2838", "FF7D86"), "Danger": ("D54941", "FF8075")}
    # name是语义键，variants依次为浅色和深色。
    for name, variants in colors.items():
        # 当前颜色的两种系统外观条目。
        entries = []
        # index区分外观，value为该外观十六进制RGB。
        for index, value in enumerate(variants):
            # 精确转换RGB资源通道，不涉及金额运算。
            components = {channel: f"{int(value[offset:offset + 2], 16) / 255:.6f}" for channel, offset in [("red", 0), ("green", 2), ("blue", 4)]}
            components["alpha"] = "1.000"
            # 当前系统外观颜色描述。
            entry = {"idiom": "universal", "color": {"color-space": "srgb", "components": components}}
            if index:
                entry["appearances"] = [{"appearance": "luminosity", "value": "dark"}]
            entries.append(entry)
        write_json(ASSETS / f"{name}.colorset/Contents.json", {"colors": entries, "info": INFO})
    write_json(ASSETS / "Contents.json", {"info": INFO})


def prepare_app_icon():
    """用本地代码绘制品牌黄底账本符号；不打包Windows字体。"""
    # iOS单源1024像素不透明App图标。
    icon = Image.new("RGB", (1024, 1024), "#FFE639")
    # 简洁账本线条与分组色块，沿用产品颜色。
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle((210, 150, 814, 874), radius=65, fill="#FFFFFF")
    draw.rounded_rectangle((210, 150, 304, 874), radius=35, fill="#202124")
    draw.rounded_rectangle((375, 310, 690, 350), radius=20, fill="#202124")
    draw.rounded_rectangle((375, 430, 665, 470), radius=20, fill="#202124")
    draw.rounded_rectangle((375, 570, 485, 680), radius=25, fill="#249E68")
    draw.rounded_rectangle((555, 570, 665, 680), radius=25, fill="#E34D59")
    # 原生AppIcon资源目录。
    destination = ASSETS / "AppIcon.appiconset"
    destination.mkdir(parents=True, exist_ok=True)
    icon.save(destination / "AppIcon.png")
    write_json(destination / "Contents.json", {"images": [{"filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}], "info": INFO})


if __name__ == "__main__":
    prepare_theme()
    convert_icons()
    prepare_app_icon()
