import SwiftUI
import Charts
import DCAKit

/// Main content view for the DCA Visualizer
struct ContentView: View {
    @State private var viewModel: SimulationViewModel

    @State private var showingConfig = false

    // Y-axis scale management for smooth animation
    @State private var yAxisMax: Double = 1000
    @State private var scaleManager: YAxisScaleManager?

    init(viewModel: SimulationViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.simulationStore.isLoading {
                    loadingView
                } else if let error = viewModel.simulationStore.errorMessage {
                    errorView(message: error)
                } else if viewModel.simulationStore.hasData {
                    mainContent
                } else {
                    emptyStateView
                }
            }
            .navigationTitle(viewModel.configStore.ticker)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingConfig = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityIdentifier("settingsButton")
                }
            }
            .sheet(isPresented: $showingConfig) {
                ConfigSheet(
                    configStore: viewModel.configStore,
                    onDismiss: {
                        showingConfig = false
                        viewModel.runSimulation()
                    }
                )
            }
            .onChange(of: showingConfig) { _, isShowing in
                // Pause playback when opening settings to prevent background 60fps updates
                // that compete with form interactions and cause freezing
                if isShowing {
                    viewModel.playbackStore.pause()
                }
            }
        }
        .task {
            if shouldAutoRunSimulation {
                viewModel.runSimulation()
            }
        }
        .onChange(of: viewModel.simulationStore.dcaResult.points.count) { _, newCount in
            // Configure scale manager when simulation data loads or changes
            guard newCount > 0 else { return }
            configureScaleManager()
        }
        .onChange(of: viewModel.playbackStore.currentIndex) { _, newIndex in
            // Update Y-axis scale during playback
            updateYAxisScale(for: newIndex)
        }
#if DEBUG
        .overlay(alignment: .bottom) {
            Text(testStatusText)
                .font(.caption2)
                .foregroundStyle(.clear)
                .accessibilityIdentifier("testStatusLabel")
        }
#endif
    }

    // MARK: - Y-Axis Scale Management

    /// Configure the scale manager with the full dataset
    /// Called when simulation results are loaded
    private func configureScaleManager() {
        let lumpSumPoints = viewModel.simulationStore.lumpSumResult.isEmpty
            ? nil
            : viewModel.simulationStore.lumpSumResult.points
        scaleManager = YAxisScaleManager(
            dcaPoints: viewModel.simulationStore.dcaResult.points,
            lumpSumPoints: lumpSumPoints
        )
        // Initialize scale to first threshold
        if let manager = scaleManager,
           let firstValue = viewModel.simulationStore.dcaResult.points.first?.totalValue {
            yAxisMax = manager.targetMax(for: firstValue)
        }
    }

    /// Update Y-axis scale based on current playback position
    /// Only animates when crossing to a new threshold
    private func updateYAxisScale(for index: Int) {
        guard let manager = scaleManager else { return }

        // Get max visible value from DCA points
        let dcaMax = viewModel.simulationStore.dcaResult.points
            .prefix(index + 1)
            .map(\.totalValue)
            .max() ?? 0

        // Get max visible value from lump sum points (if enabled)
        let lumpMax: Double = {
            if viewModel.configStore.showLumpSum,
               !viewModel.simulationStore.lumpSumResult.isEmpty {
                return viewModel.simulationStore.lumpSumResult.points
                    .prefix(index + 1)
                    .map(\.totalValue)
                    .max() ?? 0
            }
            return 0
        }()

        let newTarget = manager.targetMax(for: max(dcaMax, lumpMax))

        // Only animate if crossing to a new threshold
        if newTarget != yAxisMax {
            withAnimation(.easeInOut(duration: 0.3)) {
                yAxisMax = newTarget
            }
        }
    }

    private var testStatusText: String {
        let state: String = {
            switch viewModel.simulationStore.loadingState {
            case .idle:
                return "idle"
            case .loading:
                return "loading"
            case .loaded:
                return "loaded"
            case .error:
                return "error"
            }
        }()

        let cache = viewModel.simulationStore.isFromCache ? "cache" : "live"
        return "state=\(state) cache=\(cache) points=\(viewModel.simulationStore.dataPointCount)"
    }

    private var shouldAutoRunSimulation: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil
    }

    // MARK: - Subviews

    private var mainContent: some View {
        VStack(spacing: 0) {
            // Chart takes most of the space
            // Using .equatable() to leverage ChartView's Equatable conformance
            // This helps SwiftUI skip unnecessary chart rebuilds during playback
            ChartView(
                result: viewModel.simulationStore.dcaResult,
                lumpSumResult: viewModel.configStore.showLumpSum ? viewModel.simulationStore.lumpSumResult : nil,
                currentIndex: viewModel.playbackStore.currentIndex,
                yAxisMax: yAxisMax
            )
            .equatable()
            .frame(maxHeight: .infinity)
            .accessibilityIdentifier("chartView")

            Divider()

            // Metrics summary
            MetricsSummary(
                result: viewModel.simulationStore.dcaResult,
                currentIndex: viewModel.playbackStore.currentIndex
            )
            .padding()
            .accessibilityIdentifier("metricsSummary")

            Divider()

            // Playback controls
            PlaybackControls(
                playbackStore: viewModel.playbackStore
            )
            .padding()
            .accessibilityIdentifier("playbackControls")

            // Cache indicator
            if viewModel.simulationStore.isFromCache,
               let age = viewModel.simulationStore.cacheAgeDescription {
                HStack {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.caption2)
                    Text("Data from \(age)")
                        .font(.caption2)
                }
                .foregroundStyle(.secondary)
                .padding(.bottom, 8)
                .accessibilityIdentifier("cacheIndicator")
            }
        }
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading \(viewModel.configStore.ticker)...")
                .foregroundStyle(.secondary)
        }
        .accessibilityIdentifier("loadingView")
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.red)
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("errorMessage")
            Button("Try Again") {
                viewModel.runSimulation()
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("errorRetryButton")
        }
        .padding()
        .accessibilityIdentifier("errorView")
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)
            Text("Configure Your Investment")
                .font(.title2)
            Text("Tap the gear icon to set up your DCA simulation")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Get Started") {
                showingConfig = true
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("getStartedButton")
        }
        .padding()
        .accessibilityIdentifier("emptyStateView")
    }
}

#Preview {
    if let vm = SimulationViewModel(baseURLString: "https://example.com") {
        ContentView(viewModel: vm)
    }
}
