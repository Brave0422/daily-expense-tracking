import SwiftUI

/// 月或年选择，草稿应用后才改变父查询。
struct PeriodSheet: View {
    /// 关闭选择器。
    @Environment(\.dismiss) private var dismiss
    /// true 只选年。
    let yearly: Bool
    /// 是否采用统计边界。
    var statistics = false
    /// 本地年份草稿。
    @State var year: Int
    /// 本地月份草稿。
    @State var month: Int
    /// 应用回调，参数依次为年、月。
    let apply: (Int, Int) -> Void
    /// 非法边界提示。
    @State private var error: String?
    /// 原生表单周期选择。
    var body: some View {
        NavigationStack {
            Form {
                Stepper("\(year)年", value: $year, in: 1000...9999)
                TextField("年份", value: $year, format: .number.grouping(.never)).keyboardType(.numberPad)
                if !yearly {
                    Picker("月份", selection: $month) {
                        ForEach(1...12, id: \.self) { value in
                            // value 是自然月份。
                            Text("\(value)月").tag(value)
                        }
                    }.pickerStyle(.wheel)
                }
                // error为当前捕获的错误或持续错误提示，用于分类处理和就地反馈。
                if let error { ErrorNotice(message: error) }
            }.navigationTitle(yearly ? "选择年份" : "选择月份").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("应用") {
                            // 统计边界保留上一完整比较周期，不把非法参数发到后端。
                            var query = StatisticsQuery()
                            query.yearly = yearly
                            query.year = year
                            query.month = month
                            do {
                                if statistics { _ = try query.parameters(for: .trend) }
                                else if !(1000...9999).contains(year) { throw ValidationError(message: "请选择1000至9999年") }
                                apply(year, month)
                                dismiss()
                            } catch { self.error = error.localizedDescription }
                        }
                    }
                }
        }.presentationDetents([.medium, .large])
    }
}
