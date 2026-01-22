import Foundation
import DCAKit

/// Manages smooth Y-axis scaling with "nice" number thresholds
///
/// This manager precomputes scale thresholds at initialization, then provides
/// O(1) lookups for the appropriate ceiling during animation playback.
///
/// - Note: Uses the "nice numbers" algorithm to select aesthetically pleasing
///   axis bounds (e.g., $5K, $10K, $25K, $50K) rather than arbitrary values.
struct YAxisScaleManager {
    /// Precomputed nice thresholds for the dataset, sorted ascending
    private let thresholds: [Double]

    /// Initialize with full datasets to compute thresholds
    /// - Parameters:
    ///   - dcaPoints: All DCA simulation points
    ///   - lumpSumPoints: All lump sum simulation points (if shown)
    init(dcaPoints: [SimulationPoint], lumpSumPoints: [SimulationPoint]?) {
        let allValues = dcaPoints.map(\.totalValue) +
                        (lumpSumPoints?.map(\.totalValue) ?? [])
        let overallMax = allValues.max() ?? 1000
        self.thresholds = Self.computeNiceThresholds(upTo: overallMax)
    }

    /// Returns the appropriate scale ceiling for the given visible maximum
    ///
    /// Finds the smallest threshold that is at least 10% larger than the visible max.
    /// This headroom prevents the data from touching the top of the chart.
    ///
    /// - Parameter visibleMax: The maximum value currently visible in the chart
    /// - Returns: The appropriate Y-axis ceiling
    func targetMax(for visibleMax: Double) -> Double {
        let withHeadroom = visibleMax * 1.1  // 10% headroom
        return thresholds.first { $0 >= withHeadroom } ?? thresholds.last ?? visibleMax
    }

    /// Computes nice round thresholds ($1K, $2.5K, $5K, $10K, $25K, etc.)
    ///
    /// Uses multipliers [1, 2.5, 5, 10] at each power of 10 to create
    /// natural-feeling scale boundaries.
    ///
    /// - Parameter max: The overall maximum value to cover
    /// - Returns: Sorted array of nice threshold values
    private static func computeNiceThresholds(upTo max: Double) -> [Double] {
        // Multipliers that produce aesthetically pleasing numbers
        // 1x, 2.5x, 5x at each power of 10
        let niceMultipliers: [Double] = [1, 2.5, 5, 10]
        var thresholds: [Double] = []
        var magnitude: Double = 1000  // Start at $1K

        // Generate thresholds up to 2x the max (covers any reasonable headroom)
        while magnitude <= max * 2 {
            for mult in niceMultipliers {
                let value = magnitude * mult
                thresholds.append(value)
            }
            magnitude *= 10
        }

        // Ensure we have at least some thresholds for small values
        if thresholds.isEmpty {
            thresholds = [1000, 2500, 5000, 10000]
        }

        return thresholds.sorted()
    }
}
