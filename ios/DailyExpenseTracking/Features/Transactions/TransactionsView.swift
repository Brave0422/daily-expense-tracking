import SwiftUI

/// 全屏录入路由，仅 UI UUID 不发送给服务端。
struct TransactionEditorRoute: Identifiable {
    /// 模态标识。
    let id = UUID()
    /// nil 新增，非 nil 使用明细快照完整编辑。
    let transaction: Transaction?
}

/// 原生流水页，按当前模式保留完整周期和筛选结果。
@MainActor struct TransactionsView: View {
    /// 当前会话依赖。
    @Environment(AppModel.self) private var app
    /// 两套查询状态。
    @State private var model = TransactionsModel()
    /// 筛选草稿面板。
    @State private var filtering = false
    /// 周期面板。
    @State private var choosingPeriod = false
    /// 当前只读详情快照。
    @State private var selected: Transaction?
    /// 详情关闭后再打开编辑。
    @State private var pendingEdit: Transaction?
    /// 顶层唯一全屏录入。
    @State private var editor: TransactionEditorRoute?
    /// 保存位置，允许用户显式跳转。
    @State private var savedDate: LedgerDate?
    /// 只有当前可见Tab读取失效数据，后台Tab保留内存上下文。
    @State private var visible = false

    /// 流水内容与原生模态。
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                ChoicePicker(title: "流水模式", selection: Binding(get: { model.dailyMode }, set: { value in
                    // value 是目标模式，首次汇总继承明细年。
                    model.switchMode(value)
                // value为当前已校验字段或控件回调值，用于对应字段的状态更新。
                }), options: [true, false]) { value in value ? "日明细" : "月汇总" }
                HStack {
                    Button { model.move(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("上一周期")
                    Button(model.periodTitle) { choosingPeriod = true }.fontWeight(.semibold).frame(minHeight: 44)
                    Button { model.move(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }.accessibilityLabel("下一周期")
                    Spacer(minLength: 0)
                    Button { filtering = true } label: { Label(model.filter.isActive ? "已筛选" : "筛选", systemImage: "line.3.horizontal.decrease.circle").frame(minHeight: 44) }
                }
                // notice为当前操作结果说明，用于持续展示已保存或处理位置。
                if let notice = model.notice { Text(notice).font(.subheadline).foregroundStyle(Theme.secondary) }
                // date为有效自然日期或Cookie到期时间，不将自然日当作UTC时间戳。
                if let date = savedDate, date.monthKey != model.month.monthKey || !model.dailyMode {
                    Button("查看已保存的\(date.year)年\(date.month)月") {
                        model.month = LedgerDate(year: date.year, month: date.month, day: 1)
                        model.dailyMode = true
                        savedDate = nil
                    }.frame(minHeight: 44)
                }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error = model.error { ErrorNotice(message: error) }
                if model.dailyMode { dailyContent } else { monthlyContent }
            }.padding(16)
        }.background(Theme.page).navigationTitle("流水")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { editor = TransactionEditorRoute(transaction: nil) } label: { Label("记一笔", systemImage: "plus") }.accessibilityIdentifier("transactions.create") } }
            .onAppear { visible = true }
            .onDisappear { visible = false }
            .task(id: model.queryKey + "-\(app.revision)-\(visible)") { if visible { await model.load(app.repository) } }
            .refreshable { await model.load(app.repository) }
            .onChange(of: model.daily.version) { _, _ in
                // 当前详情随最新列表快照更新；未保存编辑草稿独立持有，不受此处理影响。
                if let current = selected {
                    /// 最新明细中相同真实ID的记录。
                    let latest = model.daily.value?.days.flatMap { day in day.transactions }.first { transaction in transaction.id == current.id }
                    selected = latest
                    if latest == nil { model.notice = "记录已不可用或已不在当前结果中，请刷新确认" }
                }
            }
            .sheet(isPresented: $choosingPeriod) {
                PeriodSheet(yearly: !model.dailyMode, year: model.dailyMode ? model.month.year : model.year, month: model.month.month) { year, month in
                    // year、month 是用户确认周期，取消不改变原条件。
                    if model.dailyMode { model.month = LedgerDate(year: year, month: month, day: 1); model.collapsedDays = [] }
                    else { model.year = year; model.expandedMonths = [] }
                }
            }
            .sheet(isPresented: $filtering) {
                TransactionFilterView(daily: model.dailyMode, initial: model.filter) { filter in
                    // filter 是通过校验的面板快照。
                    if model.dailyMode { model.dailyFilter = filter } else { model.monthlyFilter = filter }
                }
            }
            .sheet(item: $selected, onDismiss: {
                // 单顶层模态：详情完成关闭后才呈现编辑。
                if let transaction = pendingEdit { pendingEdit = nil; editor = TransactionEditorRoute(transaction: transaction) }
            }) { transaction in
                // transaction 是当前明细完整快照，无单笔 GET 请求。
                TransactionDetailView(transaction: transaction, deleting: model.deleting) {
                    pendingEdit = transaction
                    selected = nil
                } remove: {
                    if await model.archive(transaction, app: app) { selected = nil; return nil }
                    return model.error
                }
            }
            .fullScreenCover(item: $editor) { route in
                // route 包含新增或编辑快照；保存回调只传自然日期。
                TransactionEditorView(transaction: route.transaction) { date in
                    savedDate = date
                    model.notice = "已保存到\(date.year)年\(date.month)月"
                    app.changed()
                }
            }
    }

    /// 日明细骨架、错误、空态与日分组。
    @ViewBuilder private var dailyContent: some View {
        readStatus(loading: model.daily.loading, error: model.daily.error, label: model.daily.loadedLabel)
        // result为已加载的真实服务端结果，显示时保留其原始周期和条件。
        if let result = model.daily.value {
            Text(model.daily.loadedLabel).font(.caption).foregroundStyle(Theme.secondary)
            overview(result.totals, filtered: result.filterTotals, period: result.period)
            if result.days.isEmpty { emptyContent }
            ForEach(result.days) { day in
                // day 是服务端日分组，折叠不重算金额。
                LedgerCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Button {
                            if !model.collapsedDays.insert(day.date).inserted { model.collapsedDays.remove(day.date) }
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Label((try? LedgerDate(day.date))?.display ?? day.date, systemImage: model.collapsedDays.contains(day.date) ? "chevron.right" : "chevron.down").font(.headline)
                                HStack { AmountText(amount: day.expenseTotal, type: .expense); AmountText(amount: day.incomeTotal, type: .income) }.font(.caption)
                            }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }
                        if !model.collapsedDays.contains(day.date) {
                            ForEach(day.transactions) { transaction in
                                // transaction 为详情 / 编辑提供同一真实快照。
                                Divider()
                                Button { selected = transaction } label: { TransactionRow(transaction: transaction) }.buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
    }

    /// 月汇总按服务端树结构显示，分类父级采用原生 DisclosureGroup。
    @ViewBuilder private var monthlyContent: some View {
        readStatus(loading: model.monthly.loading, error: model.monthly.error, label: model.monthly.loadedLabel)
        // result为已加载的真实服务端结果，显示时保留其原始周期和条件。
        if let result = model.monthly.value {
            Text(model.monthly.loadedLabel).font(.caption).foregroundStyle(Theme.secondary)
            overview(result.totals, filtered: result.filterTotals, period: result.period)
            if result.months.isEmpty { emptyContent }
            ForEach(result.months) { month in
                // month 是当前年内有记录的月份。
                LedgerCard {
                    DisclosureGroup(isExpanded: Binding(get: { model.expandedMonths.contains(month.month) }, set: { expanded in
                        // expanded 为该月展开状态。
                        if expanded { model.expandedMonths.insert(month.month) } else { model.expandedMonths.remove(month.month) }
                    })) {
                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(month.expenseCategories) { category in
                                // category 是一级支出汇总，子项不重复计入父额。
                                DisclosureGroup { ForEach(category.children ?? []) { child in
                                    // child 是二级汇总。
                                    summaryRow(child, type: .expense).padding(.leading, 12)
                                } } label: { summaryRow(category, type: .expense) }
                            }
                            ForEach(month.incomeCategories) { category in
                                // category 是一级收入，不构造二级。
                                summaryRow(category, type: .income)
                            }
                            Button("查看本月明细") { model.openMonth(month.month) }.frame(minHeight: 44).disabled(model.monthly.loading || model.monthly.error != nil || result.period != String(model.year))
                        }.padding(.top, 12)
                    } label: {
                        VStack(alignment: .leading) {
                            Text("\(result.period)年\(month.month)月").font(.headline)
                            HStack { AmountText(amount: month.expenseTotal, type: .expense); AmountText(amount: month.incomeTotal, type: .income) }.font(.caption)
                        }.frame(minHeight: 44)
                    }
                }
            }
        }
    }

    /// 完整周期总览；- Parameters: totals: 服务端总览；filtered: 筛选合计；period: 已加载真实周期。
    private func overview(_ totals: PeriodTotals, filtered: FilterTotals, period: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("\(period) · \(model.dailyMode ? "本月" : "本年")支出").font(.subheadline)
            AmountText(amount: totals.expense, type: .expense).font(.largeTitle.bold())
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 24) { secondaryTotals(totals) }
                VStack(alignment: .leading, spacing: 12) { secondaryTotals(totals) }
            }
            if model.filter.isActive {
                Divider()
                Text("筛选结果").font(.caption)
                AmountText(amount: filtered.expense, type: .expense)
                AmountText(amount: filtered.income, type: .income)
                Button("清除筛选") { if model.dailyMode { model.dailyFilter = TransactionFilter() } else { model.monthlyFilter = TransactionFilter() } }.frame(minHeight: 44)
            }
        }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(Theme.primarySoft, in: RoundedRectangle(cornerRadius: 16))
    }

    /// 次级收入与结余；- Parameter totals: 精确总额。
    @ViewBuilder private func secondaryTotals(_ totals: PeriodTotals) -> some View {
        VStack(alignment: .leading) { Text("收入").font(.caption); AmountText(amount: totals.income, type: .income) }
        VStack(alignment: .leading) { Text("结余").font(.caption); Text("¥" + Money.display(totals.balance)).monospacedDigit().foregroundStyle(totals.balance.hasPrefix("-") ? Theme.expense : (Money.chartValue(totals.balance) == 0 ? Theme.secondary : Theme.income)) }
    }

    /// 汇总行；- Parameters: category: 分类金额节点；type: 方向。
    private func summaryRow(_ category: CategorySummary, type: TransactionType) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack { CategoryGlyph(key: category.iconKey, background: category.backgroundColor); Text(category.name + (category.archived ? "（已删除）" : "")); Spacer(); AmountText(amount: category.amount, type: type) }
            VStack(alignment: .leading) { Text(category.name); AmountText(amount: category.amount, type: type) }
        }.padding(.vertical, 4)
    }

    /// 不伪造零金额的读取状态；- Parameters: loading: 在途；error: 失败；label: 旧结果真实条件。
    @ViewBuilder private func readStatus(loading: Bool, error: String?, label: String) -> some View {
        if loading { ProgressView(label.isEmpty ? "正在加载…" : "\(label) · 正在刷新…") }
        // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
        if let error { ErrorNotice(message: (model.notice?.hasPrefix("已保存") == true ? "已保存，列表刷新失败：" : (label.isEmpty ? "" : "\(label) · 刷新失败：")) + error) { Task { await model.load(app.repository) } } }
    }

    /// 筛选空态与正常空周期分别引导。
    private var emptyContent: some View {
        ContentUnavailableView(model.filter.isActive ? "筛选无结果" : "本周期暂无记录", systemImage: "tray", description: Text(model.filter.isActive ? "调整或清除筛选条件" : "点击右上角记一笔"))
    }
}

/// 手机流水行保留路径、标签和完整金额。
struct TransactionRow: View {
    /// 当前流水快照。
    let transaction: Transaction
    /// 大字体下金额自然排到下方。
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 12) {
                CategoryGlyph(key: transaction.category.actual.iconKey, background: transaction.category.actual.backgroundColor)
                details
                Spacer(minLength: 8)
                AmountText(amount: transaction.amount, type: transaction.type, signed: true).fixedSize()
            }
            HStack(alignment: .top, spacing: 12) {
                CategoryGlyph(key: transaction.category.actual.iconKey, background: transaction.category.actual.backgroundColor)
                VStack(alignment: .leading, spacing: 8) { details; AmountText(amount: transaction.amount, type: transaction.type, signed: true) }
            }
        }.padding(.vertical, 8).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
    }
    /// 共用文字区，宽屏右侧金额放不下时自然移至下方。
    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(transaction.title ?? transaction.category.actual.name).font(.body.weight(.medium))
            Text(transaction.category.path + (transaction.category.actual.archived ? "（已删除）" : "")).font(.caption).foregroundStyle(Theme.secondary)
            if !transaction.tags.isEmpty { Text(transaction.tags.map { tag in
                // tag 为历史关联，归档保留状态可读。
                tag.name + (tag.archived == true ? "（已删除）" : "")
            }.joined(separator: " · ")).font(.caption).foregroundStyle(Theme.secondary) }
            if transaction.remark != nil { Label("有备注", systemImage: "text.bubble").font(.caption).foregroundStyle(Theme.secondary) }
        }
    }
}
