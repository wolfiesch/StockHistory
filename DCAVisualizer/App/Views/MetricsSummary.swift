import SwiftUI
import DCAKit

/// Displays key metrics from the simulation at the current playback position
struct MetricsSummary: View {
    let result: SimulationResult
    let currentIndex: Int

    // MARK: - Static Formatters (created once, reused for all instances)

    /// Thread-safe currency formatter for display values
    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    /// Current simulation point based on playback position
    private var currentPoint: SimulationPoint? {
        guard !result.points.isEmpty,
              currentIndex < result.points.count else {
            return nil
        }
        return result.points[currentIndex]
    }

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            MetricCard(
                title: "Total Value",
                value: formatCurrency(currentPoint?.totalValue ?? 0),
                icon: "dollarsign.circle.fill",
                color: .blue
            )
            .accessibilityIdentifier("metricTotalValue")

            MetricCard(
                title: "Invested",
                value: formatCurrency(currentPoint?.principal ?? 0),
                icon: "arrow.down.circle.fill",
                color: .green
            )
            .accessibilityIdentifier("metricInvested")

            MetricCard(
                title: "Return",
                value: formatPercent(currentPoint?.currentReturn ?? 0),
                icon: currentReturn >= 0 ? "arrow.up.right" : "arrow.down.right",
                color: currentReturn >= 0 ? .green : .red
            )
            .accessibilityIdentifier("metricReturn")

            MetricCard(
                title: "Shares",
                value: formatShares(currentPoint?.shares ?? 0),
                icon: "chart.bar.fill",
                color: .purple
            )
            .accessibilityIdentifier("metricShares")

            MetricCard(
                title: "Dividends",
                value: formatCurrency(currentPoint?.dividends ?? 0),
                icon: "banknote.fill",
                color: .orange
            )
            .accessibilityIdentifier("metricDividends")

            MetricCard(
                title: "CAGR",
                value: formatPercent(result.cagr),
                icon: "chart.line.uptrend.xyaxis",
                color: .cyan
            )
            .accessibilityIdentifier("metricCAGR")
        }
    }

    // MARK: - Computed

    private var currentReturn: Double {
        currentPoint?.currentReturn ?? 0
    }

    // MARK: - Formatting

    /// Format currency using cached static formatter
    private func formatCurrency(_ value: Double) -> String {
        Self.currencyFormatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    private func formatPercent(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", value))%"
    }

    private func formatShares(_ value: Double) -> String {
        String(format: "%.4f", value)
    }
}

// MARK: - Metric Card

private struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundStyle(color)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(value)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

#Preview {
    MetricsSummary(
        result: .empty,
        currentIndex: 0
    )
    .padding()
}
