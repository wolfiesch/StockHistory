import Foundation
import QuartzCore

/// Frame-rate independent playback engine using CADisplayLink
/// - Note: Ports the web animation logic for smooth 60/120 Hz playback
///
/// ## How It Works
/// The engine uses a CADisplayLink to receive callbacks synchronized with the
/// display refresh rate. On each frame, it calculates how much time has passed
/// and advances the playback by the appropriate number of data points.
///
/// ## Frame-Rate Independence
/// The accumulator pattern ensures smooth playback regardless of display Hz:
/// - At 60Hz, each frame gets ~16.6ms of time
/// - At 120Hz (ProMotion), each frame gets ~8.3ms
/// - The accumulator converts time → points to advance
public final class PlaybackEngine {

    // MARK: - Types

    /// Callback invoked on each frame with the new index
    public typealias UpdateHandler = (Int) -> Void

    /// Callback invoked when playback completes
    public typealias CompletionHandler = () -> Void

    // MARK: - Configuration

    /// Base playback speed: points per second at 1x speed
    public static let basePointsPerSecond: Double = 30

    // MARK: - State

    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var accumulator: Double = 0
    private var currentIndex: Int = 0
    private var totalPoints: Int = 0
    private var speedMultiplier: Double = 1.0

    private var updateHandler: UpdateHandler?
    private var completionHandler: CompletionHandler?

    /// Whether the engine is currently running
    public var isRunning: Bool {
        displayLink != nil
    }

    // MARK: - Initialization

    public init() {}

    deinit {
        stop()
    }

    // MARK: - Public API

    /// Starts playback from the given index
    /// - Parameters:
    ///   - startIndex: Initial index to start from
    ///   - totalPoints: Total number of data points
    ///   - speed: Playback speed multiplier (1.0 = normal)
    ///   - onUpdate: Called on each frame with the new index
    ///   - onComplete: Called when playback reaches the end
    public func start(
        from startIndex: Int,
        totalPoints: Int,
        speed: Double = 1.0,
        onUpdate: @escaping UpdateHandler,
        onComplete: CompletionHandler? = nil
    ) {
        stop() // Stop any existing playback

        self.currentIndex = startIndex
        self.totalPoints = totalPoints
        self.speedMultiplier = speed
        self.updateHandler = onUpdate
        self.completionHandler = onComplete
        self.accumulator = 0
        self.lastTimestamp = 0

        // Create and start the display link
        let link = CADisplayLink(target: self, selector: #selector(frame(_:)))
        link.add(to: .main, forMode: .common)
        self.displayLink = link
    }

    /// Stops playback
    public func stop() {
        displayLink?.invalidate()
        displayLink = nil
        updateHandler = nil
        completionHandler = nil
    }

    /// Updates the playback speed while running
    public func setSpeed(_ speed: Double) {
        speedMultiplier = speed
    }

    /// Updates the current index (for seeking while playing)
    public func setCurrentIndex(_ index: Int) {
        currentIndex = max(0, min(index, totalPoints - 1))
    }

    // MARK: - Display Link Callback

    @objc private func frame(_ link: CADisplayLink) {
        // First frame - just record timestamp
        if lastTimestamp == 0 {
            lastTimestamp = link.timestamp
            return
        }

        // Calculate time elapsed since last frame
        let deltaTime = link.timestamp - lastTimestamp
        lastTimestamp = link.timestamp

        // Calculate points to advance based on elapsed time
        // pointsPerSecond = basePointsPerSecond * speedMultiplier
        let pointsPerSecond = Self.basePointsPerSecond * speedMultiplier

        // Add to accumulator (fractional points)
        accumulator += deltaTime * pointsPerSecond

        // Extract whole points to advance
        let pointsToAdvance = Int(accumulator)
        if pointsToAdvance > 0 {
            accumulator -= Double(pointsToAdvance)

            // Advance the index
            currentIndex += pointsToAdvance

            // Check for end of playback
            if currentIndex >= totalPoints - 1 {
                currentIndex = totalPoints - 1
                updateHandler?(currentIndex)
                stop()
                completionHandler?()
                return
            }

            // Notify update
            updateHandler?(currentIndex)
        }
    }
}
