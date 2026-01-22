import SwiftUI
import Charts
import DCAKit

/// Chart displaying the DCA simulation results
/// - Note: Uses Swift Charts for native iOS charting
/// - Note: Equatable conformance helps SwiftUI skip unnecessary chart rebuilds
struct ChartView: View, Equatable {
    let result: SimulationResult
    let lumpSumResult: SimulationResult?
    let currentIndex: Int
    let yAxisMax: Double  // Explicit Y-axis maximum for smooth scaling

    // MARK: - Equatable

    /// Custom equality check to help SwiftUI skip unnecessary updates
    /// We compare currentIndex and data point counts rather than full data equality
    /// This is safe because the parent view recreates us when result data changes
    static func == (lhs: ChartView, rhs: ChartView) -> Bool {
        lhs.currentIndex == rhs.currentIndex &&
        lhs.result.points.count == rhs.result.points.count &&
        lhs.lumpSumResult?.points.count == rhs.lumpSumResult?.points.count &&
        lhs.yAxisMax == rhs.yAxisMax
    }

    // MARK: - Static Formatters (created once, reused for all instances)

    /// Thread-safe date formatter for parsing "yyyy-MM-dd" date strings
    /// - Note: DateFormatter creation costs ~0.5-1ms each. With 3000+ points
    ///   per frame, this was causing 1.5-3 seconds of overhead per frame.
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    /// Thread-safe currency formatter for display values
    /// - Note: NumberFormatter is similarly expensive to create repeatedly
    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    /// Sliced data for current playback position
    /// - Note: Returns ArraySlice instead of creating a new Array.
    ///   ArraySlice is O(1) with zero memory allocation vs O(n) for Array copy.
    private var visiblePoints: ArraySlice<SimulationPoint> {
        guard !result.points.isEmpty else { return [] }
        let endIndex = min(currentIndex + 1, result.points.count)
        return result.points.prefix(endIndex)
    }

    /// Sliced lump sum data for current playback position
    private var visibleLumpSumPoints: ArraySlice<SimulationPoint> {
        guard let lumpSum = lumpSumResult, !lumpSum.points.isEmpty else { return [] }
        let endIndex = min(currentIndex + 1, lumpSum.points.count)
        return lumpSum.points.prefix(endIndex)
    }

    var body: some View {
        Chart {
            // Principal (invested amount) - area fill
            // Uses green to visually distinguish from the blue value line
            ForEach(visiblePoints, id: \.date) { point in
                AreaMark(
                    x: .value("Date", parseDate(point.date)),
                    y: .value("Principal", point.principal)
                )
                .foregroundStyle(
                    .linearGradient(
                        colors: [.green.opacity(0.35), .green.opacity(0.1)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }

            // DCA Total Value - main line
            ForEach(visiblePoints, id: \.date) { point in
                LineMark(
                    x: .value("Date", parseDate(point.date)),
                    y: .value("Value", point.totalValue)
                )
                .foregroundStyle(.blue)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }

            // Lump Sum comparison (if enabled)
            if lumpSumResult != nil {
                ForEach(visibleLumpSumPoints, id: \.date) { point in
                    LineMark(
                        x: .value("Date", parseDate(point.date)),
                        y: .value("Lump Sum", point.totalValue)
                    )
                    .foregroundStyle(.orange)
                    .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 5]))
                }
            }

            // Current point marker
            if let currentPoint = visiblePoints.last {
                PointMark(
                    x: .value("Date", parseDate(currentPoint.date)),
                    y: .value("Value", currentPoint.totalValue)
                )
                .foregroundStyle(.blue)
                .symbolSize(100)

                // Value annotation
                PointMark(
                    x: .value("Date", parseDate(currentPoint.date)),
                    y: .value("Value", currentPoint.totalValue)
                )
                .annotation(position: .top, spacing: 8) {
                    Text(formatCurrency(currentPoint.totalValue))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(4)
                        .background(.ultraThinMaterial)
                        .cornerRadius(4)
                }
            }
        }
        .chartYScale(domain: 0...yAxisMax)  // Explicit domain for smooth animated scaling
        .chartXAxis {
            AxisMarks(values: .stride(by: .year)) { value in
                if let date = value.as(Date.self) {
                    AxisValueLabel {
                        Text(date, format: .dateTime.year())
                    }
                }
                AxisGridLine()
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                if let amount = value.as(Double.self) {
                    AxisValueLabel {
                        Text(formatAxisCurrency(amount))
                    }
                }
                AxisGridLine()
            }
        }
        .chartLegend(position: .top, alignment: .leading) {
            HStack(spacing: 16) {
                LegendItem(color: .blue, label: "DCA Value")
                LegendItem(color: .green.opacity(0.35), label: "Principal", isArea: true)
                if lumpSumResult != nil {
                    LegendItem(color: .orange, label: "Lump Sum", isDashed: true)
                }
            }
            .font(.caption)
        }
        .padding()
    }

    // MARK: - Helpers

    /// Parse date string using cached static formatter
    private func parseDate(_ dateString: String) -> Date {
        Self.dateFormatter.date(from: dateString) ?? Date()
    }

    /// Format currency using cached static formatter
    private func formatCurrency(_ value: Double) -> String {
        Self.currencyFormatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    private func formatAxisCurrency(_ value: Double) -> String {
        if value >= 1_000_000 {
            return "$\(Int(value / 1_000_000))M"
        } else if value >= 1_000 {
            return "$\(Int(value / 1_000))K"
        }
        return "$\(Int(value))"
    }
}

// MARK: - Legend Item

private struct LegendItem: View {
    let color: Color
    let label: String
    var isArea: Bool = false
    var isDashed: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            if isArea {
                RoundedRectangle(cornerRadius: 2)
                    .fill(color)
                    .frame(width: 12, height: 8)
            } else {
                Rectangle()
                    .fill(color)
                    .frame(width: 16, height: isDashed ? 1 : 2)
                    .overlay {
                        if isDashed {
                            HStack(spacing: 2) {
                                ForEach(0..<3, id: \.self) { _ in
                                    Rectangle()
                                        .fill(color)
                                        .frame(width: 4, height: 2)
                                }
                            }
                        }
                    }
            }
            Text(label)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    ChartView(
        result: .empty,
        lumpSumResult: nil,
        currentIndex: 0,
        yAxisMax: 10000
    )
}
