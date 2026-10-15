import Foundation

/// 收支类型与服务端枚举保持一致。
enum TransactionType: String, Codable, CaseIterable, Identifiable, Sendable {
    case expense, income
    /// 分段控件使用的稳定标识。
    var id: String { rawValue }
    /// 中文方向名称。
    var title: String { self == .expense ? "支出" : "收入" }
}

/// 用户可理解的输入校验错误。
struct ValidationError: LocalizedError, Sendable {
    /// 具体字段的中文提示。
    let message: String
    /// 系统错误展示文案。
    var errorDescription: String? { message }
}

/// 金额始终使用十进制；聚合金额不转换成 Int64 分。
enum Money {
    /// POSIX 小数点规则避免设备地区改变协议格式。
    static let locale = Locale(identifier: "en_US_POSIX")

    /// 验证输入元金额；- Parameters: text: 无分隔符金额；allowZero: 筛选边界允许零。
    /// - Returns: 不含千分位的原始精确字符串；格式错误时抛出字段错误。
    static func validate(_ text: String, allowZero: Bool = false) throws -> String {
        // 不截断、不四舍五入，粘贴输入也必须通过完整校验。
        guard text.range(of: #"^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$"#, options: .regularExpression) != nil,
              let value = Decimal(string: text, locale: locale), allowZero || value > 0 else {
            throw ValidationError(message: "请输入有效金额，最多13位整数、2位小数，记账金额须大于零")
        }
        return text
    }

    /// 展示后端精确金额；- Parameter text: 元字符串；- Returns: 带千分位与两位小数的金额。
    static func display(_ text: String) -> String {
        // 直接按字符串分组，避免巨额汇总溢出或浮点舍入。
        /// 金额是否为负数，用于结余。
        let negative = text.hasPrefix("-")
        /// 不带符号的整数和小数部分。
        let parts = text.replacingOccurrences(of: "-", with: "").split(separator: ".", omittingEmptySubsequences: false)
        /// 整数文本，不做数值强转。
        let integer = String(parts.first ?? "0")
        /// 从右向左分组后的千分位文本。
        let grouped = integer.reversed().enumerated().map { index, digit in
            // index 是反向位序，digit 是当前十进制数字；每三位插入分隔符。
            (index > 0 && index % 3 == 0 ? "," : "") + String(digit)
        }.joined().reversed()
        /// 两位小数仅用于显示；服务端约定最多两位。
        let fraction = parts.count > 1 ? String(parts[1]) : ""
        return (negative ? "-" : "") + String(grouped) + "." + String((fraction + "00").prefix(2))
    }

    /// 仅供图表几何绘制；- Parameter text: 元字符串；- Returns: 有限非负绘图权重。
    static func chartValue(_ text: String) -> Double {
        /// 只用于坐标，不用于业务运算或文案。
        let value = Double(text) ?? 0
        return value.isFinite ? max(0, value) : 0
    }
}

/// 自然日期以年月日保存，桥接 DatePicker 时固定 Gregorian 与 UTC 中午。
struct LedgerDate: Hashable, Comparable, Sendable, CustomStringConvertible {
    /// 公历年份。
    let year: Int
    /// 公历月份。
    let month: Int
    /// 公历日。
    let day: Int
    /// 固定历法，不受用户佛历等设置影响。
    static var calendar: Calendar {
        /// UTC 仅用于控件桥接，自然日期不是服务端时间戳。
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        return calendar
    }
    /// 服务端 YYYY-MM-DD 文本。
    var description: String { String(format: "%04d-%02d-%02d", year, month, day) }
    /// 月周期 YYYY-MM。
    var monthKey: String { String(format: "%04d-%02d", year, month) }
    /// 日分组中文日期和星期，使用自然日期固定桥接计算。
    var display: String {
        /// 公历星期索引，星期日为1。
        let weekday = Self.calendar.component(.weekday, from: pickerDate)
        /// 面向当前简体中文版本的星期名称。
        let weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
        return "\(month)月\(day)日 " + weekdays[min(6, max(0, weekday - 1))]
    }
    /// 供控件显示的 UTC 中午时间点。
    var pickerDate: Date {
        Self.calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? .distantPast
    }
    /// 从本机公历组件获取今天，保留用户所在时区的自然日。
    static var today: LedgerDate {
        /// 本机时区公历。
        let calendar = Calendar(identifier: .gregorian)
        /// 今天的年月日组件。
        let components = calendar.dateComponents([.year, .month, .day], from: Date())
        return LedgerDate(year: components.year ?? 2000, month: components.month ?? 1, day: components.day ?? 1)
    }

    /// 创建已验证的自然日期；- Parameters: year: 年；month: 月；day: 日。
    init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// 解析服务端日期；- Parameter text: YYYY-MM-DD；非法或不存在的日历日期抛错。
    init(_ text: String) throws {
        /// 固定宽度日期组件。
        let parts = text.split(separator: "-").compactMap { part in
            // part 是当前年月日十进制片段。
            Int(part)
        }
        guard text.count == 10, parts.count == 3, (1...9999).contains(parts[0]),
              (1...12).contains(parts[1]), (1...31).contains(parts[2]) else {
            throw ValidationError(message: "日期格式应为 YYYY-MM-DD")
        }
        self.init(year: parts[0], month: parts[1], day: parts[2])
        /// 桥接后回读组件，拒绝自动归一化的 2 月 30 日。
        let components = Self.calendar.dateComponents([.year, .month, .day], from: pickerDate)
        guard components.year == year, components.month == month, components.day == day else {
            throw ValidationError(message: "请选择有效日期")
        }
    }

    /// 从固定时区的 DatePicker 回读；- Parameter date: 控件时间点。
    init(picker date: Date) {
        /// 同一历法时区读写，避免跨天。
        let components = Self.calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: components.year ?? 2000, month: components.month ?? 1, day: components.day ?? 1)
    }

    /// 自然日排序；- Parameters: lhs: 左日期；rhs: 右日期；- Returns: 是否较早。
    static func < (lhs: LedgerDate, rhs: LedgerDate) -> Bool { lhs.description < rhs.description }
}

/// 按服务端 Unicode 码点规则校验文本。
enum TextRule {
    /// trim 后的可选字段；- Parameters: text: 原输入；limit: 最大码点数；name: 字段中文名。
    /// - Returns: 空文本返回 nil，超长抛出字段错误。
    static func optional(_ text: String, limit: Int, name: String) throws -> String? {
        /// 提交前去除首尾空白。
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.unicodeScalars.count <= limit else { throw ValidationError(message: "\(name)最多\(limit)个字符") }
        return value.isEmpty ? nil : value
    }

    /// 必填名称；- Parameters: text: 原输入；name: 字段中文名；- Returns: trim 后名称。
    static func required(_ text: String, name: String = "名称") throws -> String {
        // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
        guard let value = try optional(text, limit: 50, name: name) else { throw ValidationError(message: "请输入\(name)") }
        return value
    }

    /// 邮箱规范化；- Parameter text: 原邮箱；- Returns: 小写、trim 邮箱，非法时抛错。
    static func email(_ text: String) throws -> String {
        /// 与服务端相同的邮箱大小写处理。
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard value.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil else {
            throw ValidationError(message: "请输入有效邮箱")
        }
        return value
    }

    /// 验证密码与验证码；- Parameters: password: 不 trim 的密码；code: 可选六位验证码。
    static func credentials(password: String, code: String?) throws {
        guard (6...20).contains(password.unicodeScalars.count) else { throw ValidationError(message: "密码长度须为6–20个字符") }
        if let code, code.range(of: #"^[0-9]{6}$"#, options: .regularExpression) == nil {
            // 六位数字字符串保留前导零，不转换成整数。
            throw ValidationError(message: "请输入六位数字验证码")
        }
    }
}
