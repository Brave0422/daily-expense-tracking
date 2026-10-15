import SwiftUI
import Charts
import Observation

/// 一个统计板块拥有自己的条件、结果与错误。
@MainActor @Observable final class StatisticsPanel {
    /// 默认当月支出二级。
    var query = StatisticsQuery()
    /// 排行或占比结果。
    var categories = QueryState<CategoryStatistics>()
    /// 趋势结果。
    var trend = QueryState<TransactionTrend>()
    /// 便于取消旧读取的条件指纹。
    var key: String { "\(query.type.rawValue)-\(query.period)-\(query.yearly)-\(query.level)-\(query.ascending)" }
    /// 结果真实条件标签。
    var label: String { query.title + " · " + query.type.title + " · " + (query.level == 1 ? "一级" : "二级") }

    /// 仅查询可见板块；- Parameters: section: 当前板块；repository: 当前身份仓库。
    func load(_ section: StatisticsSection, repository: LedgerRepository) async {
        /// 当前条件值快照。
        let query = self.query
        if section == .trend { await trend.load(label: query.title + " · " + query.type.title) { try await repository.trend(query) } }
        else { await categories.load(label: label + (section == .ranking ? (query.ascending ? " · 升序" : " · 降序") : "")) { try await repository.categoryStatistics(section, query: query) } }
    }
}

/// 三个独立板块长期保留在当前登录会话。
@MainActor @Observable final class StatisticsModel {
    /// 排行状态。
    let ranking = StatisticsPanel()
    /// 占比状态。
    let proportion = StatisticsPanel()
    /// 趋势状态。
    let trend = StatisticsPanel()
    /// 当前板块。
    var section: StatisticsSection = .ranking

    /// 选择已有状态，切换不复制条件；- Parameter section: 板块；- Returns: 该板块状态。
    func panel(_ section: StatisticsSection) -> StatisticsPanel {
        switch section { case .ranking: ranking; case .proportion: proportion; case .trend: trend }
    }
}

/// 手机只显示一个统计板块，保留品牌卡片和原生图表触摸。
@MainActor struct StatisticsView: View {
    /// 当前依赖。
    @Environment(AppModel.self) private var app
    /// 当前会话三个板块。
    @State private var model = StatisticsModel()
    /// 周期选择器。
    @State private var choosingPeriod = false
    /// 不可见板块与Tab只保留状态，在下次可见时重查。
    @State private var visible = false
    /// 统计条件与已加载结果。
    var body: some View {
        /// 可观察当前板块，条件改变只影响该板块。
        @Bindable var panel = model.panel(model.section)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // section为当前统计板块选项，对应独立条件与结果状态。
                ChoicePicker(title: "统计板块", selection: $model.section, options: StatisticsSection.allCases) { section in section.title }
                LedgerCard {
                    VStack(spacing: 14) {
                        // type为当前真实收支类型，使用服务端枚举值。
                        ChoicePicker(title: "收支", selection: $panel.query.type, options: TransactionType.allCases) { type in type.title }
                        if model.section != .trend {
                            ChoicePicker(title: "分类层级", selection: Binding(get: { panel.query.level }, set: { value in panel.query.expenseLevel = value }), options: [1, 2]) { level in
                                // level为合法分类层级，收入状态下显示一级且禁止切换。
                                level == 1 ? "一级" : "二级"
                            }.disabled(panel.query.type == .income)
                            if panel.query.type == .income { Text("收入仅一级").font(.caption).foregroundStyle(Theme.secondary) }
                        }
                        ChoicePicker(title: "统计周期", selection: Binding(get: { panel.query.yearly }, set: { value in
                            // value 是月年选择，按该板块各年记忆恢复月份。
                            panel.query.setYearly(value)
                        // yearly为月年选项，true为年、false为月。
                        }), options: [false, true]) { yearly in yearly ? "年" : "月" }
                        HStack {
                            Button(panel.query.title) { choosingPeriod = true }.frame(minHeight: 44)
                            Spacer()
                            if model.section == .ranking {
                                Button { panel.query.ascending.toggle() } label: { Label(panel.query.ascending ? "金额升序" : "金额降序", systemImage: panel.query.ascending ? "arrow.up" : "arrow.down").frame(minHeight: 44) }
                            }
                        }
                    }
                }
                if model.section == .trend {
                    if panel.trend.loading { ProgressView("正在加载趋势…") }
                    // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                    if let error = panel.trend.error { ErrorNotice(message: panel.trend.loadedLabel + " · " + error) { Task { await panel.load(.trend, repository: app.repository) } } }
                    // result为已加载的真实服务端结果，显示时保留其原始周期和条件。
                    if let result = panel.trend.value {
                        Text(panel.trend.loadedLabel).font(.caption).foregroundStyle(Theme.secondary)
                        TrendChartView(result: result)
                    }
                } else {
                    if panel.categories.loading { ProgressView("正在加载统计…") }
                    // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                    if let error = panel.categories.error { ErrorNotice(message: panel.categories.loadedLabel + " · " + error) { Task { await panel.load(model.section, repository: app.repository) } } }
                    // result为已加载的真实服务端结果，显示时保留其原始周期和条件。
                    if let result = panel.categories.value {
                        Text(panel.categories.loadedLabel).font(.caption).foregroundStyle(Theme.secondary)
                        LedgerCard { VStack(alignment: .leading, spacing: 8) {
                            Text("\(result.period) · \(result.type.title) · \(result.transactionCount)笔").font(.subheadline)
                            AmountText(amount: result.totalAmount, type: result.type).font(.largeTitle.bold())
                        } }
                        if result.items.isEmpty { ContentUnavailableView("本周期暂无统计", systemImage: "chart.pie") }
                        else if model.section == .ranking { RankingView(result: result) }
                        else { ProportionChartView(result: result) }
                    }
                }
                Text("统计不包含已删除分类下的流水；历史流水总览可能与统计不同。").font(.footnote).foregroundStyle(Theme.secondary)
            }.padding(16)
        }.background(Theme.page).navigationTitle("统计")
            .onAppear { visible = true }
            .onDisappear { visible = false }
            .task(id: model.section.rawValue + panel.key + "-\(app.revision)-\(visible)") { if visible { await panel.load(model.section, repository: app.repository) } }
            .refreshable { await panel.load(model.section, repository: app.repository) }
            .sheet(isPresented: $choosingPeriod) {
                PeriodSheet(yearly: panel.query.yearly, statistics: true, year: panel.query.year, month: panel.query.month) { year, month in
                    // year、month 是该板块确认周期。
                    panel.query.year = year
                    panel.query.month = month
                    if !panel.query.yearly { panel.query.rememberedMonths[year] = month }
                }
            }
    }
}

/// 排行保持服务端全量顺序，不截 Top 10，不添加下钻假入口。
struct RankingView: View {
    /// 已加载结果。
    let result: CategoryStatistics
    /// 连续排名和金额。
    var body: some View {
        LedgerCard {
            VStack(spacing: 16) {
                ForEach(Array(result.items.enumerated()), id: \.element.id) { entry in
                    // entry.offset 是排名，entry.element 是当前分类，不按金额字符串再排序。
                    RankingRow(item: entry.element, rank: entry.offset + 1, type: result.type, showParent: result.items.filter { candidate in
                        // candidate是当前结果另一分类，只在同名时补充父级。
                        candidate.name == entry.element.name
                    }.count > 1)
                    if entry.offset < result.items.count - 1 { Divider() }
                }
            }
        }
    }
}

/// 默认单行排行，金额与百分比靠右；大字体或长金额放不下时自然改纵向。
struct RankingRow: View {
    /// 当前分类原始金额项。
    let item: StatisticsItem
    /// 连续显示排名，从1开始。
    let rank: Int
    /// 金额方向语义。
    let type: TransactionType
    /// 是否与其他项同名，需要显示父级。
    let showParent: Bool
    /// 不添加下钻箭头或本地排序。
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(rank)").font(.headline).frame(minWidth: 22).foregroundStyle(rank <= 3 ? Theme.text : Theme.secondary)
                .padding(4).background(rank <= 3 ? Theme.primarySoft : .clear, in: RoundedRectangle(cornerRadius: 6))
            CategoryGlyph(key: item.iconKey, background: item.backgroundColor)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top) { name; Spacer(minLength: 12); amount.fixedSize() }
                VStack(alignment: .leading, spacing: 8) { name; amount }
            }
        }.accessibilityElement(children: .combine).accessibilityLabel("第\(rank)名，\(item.parent?.name ?? "")\(item.name)，\(Money.display(item.amount))元，占比\(item.percentage)%")
    }
    /// 同名时显示父类；父级关系始终包含在VoiceOver描述中。
    private var name: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.name)
            // parent是当前二级分类真实父级，按ID区分相同子类名称。
            if showParent, let parent = item.parent { Text(parent.name).font(.caption).foregroundStyle(Theme.secondary) }
        }
    }
    /// 保留原金额和接口百分比，不按图表数值反算。
    private var amount: some View {
        VStack(alignment: .trailing, spacing: 4) {
            AmountText(amount: item.amount, type: type)
            Text(item.percentage + "%").font(.caption).foregroundStyle(Theme.secondary)
        }
    }
}

/// 原生实心饼图，完整图例可选择很小的扇区。
struct ProportionChartView: View {
    /// 原始金额和百分比。
    let result: CategoryStatistics
    /// 原生角度触摸累计值。
    @State private var angle: Double?
    /// 当前选择分类 ID。
    @State private var selected: Int64?
    /// 图表与完整文字替代。
    var body: some View {
        LedgerCard {
            VStack(alignment: .leading, spacing: 18) {
                if Money.chartValue(result.totalAmount) > 0 {
                    Chart(result.items) { item in
                        // item 金额仅在绘图时转 Double，原文本不变。
                        SectorMark(angle: .value("金额", Money.chartValue(item.amount)), angularInset: 1)
                            .foregroundStyle(Theme.chartColor(item.categoryId)).opacity(selected == nil || selected == item.id ? 1 : 0.35)
                    }.frame(height: 260).chartLegend(.hidden).chartAngleSelection(value: $angle)
                        .accessibilityLabel("分类占比饼图，可通过下方完整图例逐项选择")
                }
                // item为当前统计分类原始项，保留金额和百分比字符串。
                if let item = result.items.first(where: { item in item.id == selected }) {
                    // parent为二级分类所属一级关系，保留路径或继承背景语义。
                    VStack(alignment: .leading) { Text(((item.parent?.name).map { parent in parent + " / " } ?? "") + item.name); AmountText(amount: item.amount, type: result.type); Text(item.percentage + "%") }
                        .padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Theme.primarySoft, in: RoundedRectangle(cornerRadius: 12))
                }
                ForEach(result.items) { item in
                    // 每个图例项保留原始金额、百分比与稳定颜色。
                    Button { selected = item.id } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Circle().fill(Theme.chartColor(item.categoryId)).frame(width: 12, height: 12).padding(.top, 6)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.name).fontWeight(selected == item.id ? .semibold : .regular)
                                // parent为二级分类所属一级关系，保留路径或继承背景语义。
                                if let parent = item.parent { Text(parent.name).font(.caption).foregroundStyle(Theme.secondary) }
                                AmountText(amount: item.amount, type: result.type)
                                Text(item.percentage + "%").font(.caption).foregroundStyle(Theme.secondary)
                            }
                            Spacer()
                            if selected == item.id { Image(systemName: "checkmark") }
                        }.frame(minHeight: 44)
                    }.buttonStyle(.plain).accessibilityAddTraits(selected == item.id ? [.isSelected] : [])
                }
            }
        }.onChange(of: angle) { _, value in
            // value 是扇区触摸累计金额，仅作为几何选择。
            guard let value else { return }
            /// 遍历累计绘图权重以命中分类 ID。
            var cumulative = 0.0
            // item 是每个原始扇区，保留接口顺序。
            for item in result.items { cumulative += Money.chartValue(item.amount); if value <= cumulative { selected = item.id; break } }
        }.onChange(of: result.period) { _, _ in selected = nil; angle = nil }
    }
}

/// 完整时间轴黄色柱图，原金额摘要和可访问数据表。
struct TrendChartView: View {
    /// 已加载趋势与上期比较。
    let result: TransactionTrend
    /// 原生 X 轴选择序号。
    @State private var selectedIndex: Int?
    /// 全零时保留合理 Y 轴范围。
    private var upperBound: Double { max(1, result.series.map { point in Money.chartValue(point.amount) }.max() ?? 0) * 1.1 }
    /// 涨跌颜色遵循 Web 收支语义。
    private var changeColor: Color {
        switch result.changeStatus {
        case .unchanged: Theme.secondary
        case .increase, .new: Theme.color(result.type)
        case .decrease: Theme.color(result.type == .expense ? .income : .expense)
        }
    }
    /// 比较信息、柱图和固定选择摘要。
    var body: some View {
        LedgerCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("\(result.period) · \(result.type.title) · \(result.transactionCount)笔").font(.subheadline)
                AmountText(amount: result.totalAmount, type: result.type).font(.largeTitle.bold())
                Text("上期 \(result.previousPeriod) · ¥\(Money.display(result.previousTotalAmount))").font(.subheadline).foregroundStyle(Theme.secondary)
                Text(result.changeTitle).foregroundStyle(changeColor)
                Chart {
                    ForEach(Array(result.series.enumerated()), id: \.element.id) { entry in
                        // entry.offset 是完整自然周期位置，零值不画假柱高。
                        BarMark(x: .value("时间", entry.offset), y: .value("金额", Money.chartValue(entry.element.amount)))
                            .foregroundStyle(Theme.primary).opacity(selectedIndex == nil || selectedIndex == entry.offset ? 1 : 0.4)
                            .accessibilityLabel(entry.element.date).accessibilityValue(Money.display(entry.element.amount) + "元")
                    }
                }.frame(height: 260).chartYScale(domain: 0...upperBound)
                    .chartXScale(domain: -1...max(1, result.series.count))
                    .chartXSelection(value: $selectedIndex)
                    .chartXAxis {
                        AxisMarks(values: Array(stride(from: 0, to: result.series.count, by: result.periodType == "month" ? 5 : 2))) { value in
                            // value 是稀疏轴标记，全部数据点仍然保留。
                            AxisValueLabel {
                                // index为当前真实项在草稿或完整时间轴中的位置，使用前检查有效范围。
                                if let index = value.as(Int.self), result.series.indices.contains(index) { Text(String(result.series[index].date.suffix(2))) }
                            }
                        }
                    }
                // index为当前真实项在草稿或完整时间轴中的位置，使用前检查有效范围。
                if let index = selectedIndex, result.series.indices.contains(index) {
                    Text("\(result.series[index].date) · ¥\(Money.display(result.series[index].amount))").monospacedDigit().padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Theme.primarySoft, in: RoundedRectangle(cornerRadius: 12))
                } else { Text("点按或横向拖动柱图查看原金额").font(.caption).foregroundStyle(Theme.secondary) }
                DisclosureGroup("完整时间点与金额") {
                    ForEach(result.series) { point in
                        // point 提供 VoiceOver 和小柱的完整替代访问路径。
                        HStack { Text(point.date); Spacer(); AmountText(amount: point.amount, type: result.type) }.padding(.vertical, 4)
                    }
                }
            }
        }.onChange(of: result.period) { _, _ in selectedIndex = nil }
    }
}
