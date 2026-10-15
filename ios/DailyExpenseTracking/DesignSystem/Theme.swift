import SwiftUI
import UIKit

/// Web 品牌语义色集中管理，资源包含浅深色变体。
enum Theme {
    /// 黄色主操作。
    static let primary = Color("Primary")
    /// 浅黄总览背景。
    static let primarySoft = Color("PrimarySoft")
    /// 页面背景。
    static let page = Color("Page")
    /// 卡片背景。
    static let surface = Color("Surface")
    /// 主要文字。
    static let text = Color("TextPrimary")
    /// 次级文字。
    static let secondary = Color("TextSecondary")
    /// 边界描线。
    static let border = Color("Border")
    /// 小字号支出使用增强对比度绿色。
    static let expense = Color("Expense")
    /// 小字号收入使用增强对比度红色。
    static let income = Color("Income")
    /// 错误和删除。
    static let danger = Color("Danger")
    /// 黄底操作始终深色字。
    static let onPrimary = Color(red: 32 / 255, green: 33 / 255, blue: 36 / 255)

    /// 收支语义颜色；- Parameter type: 方向；- Returns: 支出绿、收入红。
    static func color(_ type: TransactionType) -> Color { type == .expense ? expense : income }

    /// 按 ID 稳定映射图表颜色；- Parameter id: 分类 ID；- Returns: 稳定扇区颜色，独立于图标背景。
    static func chartColor(_ id: Int64) -> Color {
        /// 黄金角分散相邻 ID，不使用进程随机 hashValue。
        let hue = (Double(id % 3600) * 0.61803398875).truncatingRemainder(dividingBy: 1)
        return Color(hue: hue, saturation: 0.58, brightness: 0.83)
    }
}

extension Color {
    /// 从后端十六进制颜色构造；- Parameter hex: #RRGGBB；非法用中性灰。
    init(hex: String) {
        /// 后端分类颜色仅用于本地渲染。
        let value = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x888888
        self.init(.sRGB, red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255, opacity: 1)
    }
}

/// 统一白色圆角卡片。
struct LedgerCard<Content: View>: View {
    /// 当前卡片内容。
    let content: Content
    /// 构建卡片内容；- Parameter content: 当前卡片子视图构建器。
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    /// 语义表面与轻描边。
    var body: some View {
        content.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 0.5))
    }
}

/// 分类只使用已打包的 Web 中心图形，未知 key 明确占位。
struct CategoryGlyph: View {
    /// 图标键。
    let key: String
    /// 后端最终背景。
    let background: String
    /// 基础图标尺寸，自动跟随字体放大。
    @ScaledMetric var size: CGFloat = 34
    /// 圆背景与独立中心图形。
    var body: some View {
        ZStack {
            Circle().fill(Color(hex: background))
            if UIImage(named: key) != nil {
                Image(key).resizable().scaledToFit().padding(2)
            } else {
                Image(systemName: "questionmark").foregroundStyle(.white)
            }
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
}

/// 完整金额不截断，VoiceOver 包含方向与元单位。
struct AmountText: View {
    /// 精确元字符串。
    let amount: String
    /// 收支方向。
    let type: TransactionType
    /// 单笔显示 + / -，汇总不显示。
    var signed = false
    /// 金额文本允许自然换行。
    var body: some View {
        Text((signed ? (type == .expense ? "− " : "+ ") : "") + "¥" + Money.display(amount))
            .monospacedDigit().fontWeight(.semibold).foregroundStyle(Theme.color(type))
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel("\(type.title)\(Money.display(amount))元")
    }
}

/// 可持久阅读的错误与重试，不用短暂 toast 隐藏失败。
struct ErrorNotice: View {
    /// 用户可理解的错误文案。
    let message: String
    /// 可选显式重试动作。
    var retry: (() -> Void)?
    /// 错误卡片，重试按钮至少44点。
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(message, systemImage: "exclamationmark.circle").foregroundStyle(Theme.danger)
            // retry为调用方提供的显式重试动作，点击后保持当前查询条件。
            if let retry { Button("重试", action: retry).frame(minHeight: 44) }
        }.padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12)).accessibilityElement(children: .contain)
    }
}

/// 黄色填充按钮上的深色文字。
struct PrimaryButtonStyle: ButtonStyle {
    /// 系统按钮状态；- Parameter configuration: 标签及按下状态；- Returns: 品牌按钮。
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.fontWeight(.semibold).frame(maxWidth: .infinity, minHeight: 48)
            .foregroundStyle(Theme.onPrimary).background(Theme.primary.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// 动态字体下仍可纵向排布的品牌分段。
struct ChoicePicker<Selection: Hashable>: View {
    /// 无障碍名称。
    let title: String
    /// 当前选中值。
    @Binding var selection: Selection
    /// 合法选项，按产品顺序呈现。
    let options: [Selection]
    /// 选项到中文标题的映射，参数为当前选项。
    let label: (Selection) -> String
    /// 辅助字号使用纵向选项，避免系统分段控件截掉文字。
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// 创建品牌分段；- Parameters: title: 无障碍名称；selection: 父级选择；options: 合法选项；label: 每项中文标题。
    init(title: String, selection: Binding<Selection>, options: [Selection], label: @escaping (Selection) -> String) {
        self.title = title
        _selection = selection
        self.options = options
        self.label = label
    }
    /// 黄色选中态与VoiceOver选择语义；各点击区域至少44点。
    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize { VStack(spacing: 4) { buttons } }
            else { HStack(spacing: 4) { buttons } }
        }.padding(4).background(Theme.page, in: RoundedRectangle(cornerRadius: 12)).accessibilityLabel(title)
    }
    /// 每个选项使用系统Button响应辅助功能和点击事件。
    private var buttons: some View {
        ForEach(options, id: \.self) { option in
            // option 是当前合法选择，点击只改变父级绑定，不直接发请求。
            Button { selection = option } label: {
                Text(label(option)).font(.subheadline.weight(.medium)).frame(maxWidth: .infinity, minHeight: 44)
                    .foregroundStyle(selection == option ? Theme.onPrimary : Theme.secondary)
                    .background(selection == option ? Theme.primary : .clear, in: RoundedRectangle(cornerRadius: 9))
            }.buttonStyle(.plain).accessibilityAddTraits(selection == option ? [.isSelected] : [])
        }
    }
}
