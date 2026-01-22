import Foundation

/// Observable store for playback state
/// - Note: Mirrors `usePlaybackStore` from the web TypeScript implementation
@Observable
public final class PlaybackStore {

    // MARK: - Types

    /// Available playback speeds
    public enum PlaybackSpeed: Double, CaseIterable, Identifiable {
        case half = 0.5
        case normal = 1.0
        case double = 2.0
        case quadruple = 4.0
        case octuple = 8.0

        public var id: Double { rawValue }

        public var label: String {
            switch self {
            case .half: return "0.5x"
            case .normal: return "1x"
            case .double: return "2x"
            case .quadruple: return "4x"
            case .octuple: return "8x"
            }
        }
    }

    // MARK: - Private State

    /// The animation engine that drives playback
    private let engine = PlaybackEngine()

    /// Last time we updated the @Observable currentIndex (for throttling)
    private var lastUpdateTime: CFAbsoluteTime = 0

    /// Throttle interval in seconds (~10fps for SwiftUI updates, engine still runs at 60fps)
    private let updateInterval: CFAbsoluteTime = 0.1

    // MARK: - State

    /// Whether playback is currently running
    public var isPlaying: Bool = false

    /// Current index in the data points array
    public var currentIndex: Int = 0

    /// Playback speed multiplier
    public var speed: PlaybackSpeed = .normal

    /// Total number of data points available
    public var totalPoints: Int = 0

    // MARK: - Computed Properties

    /// Progress as a value between 0 and 1
    public var progress: Double {
        guard totalPoints > 1 else { return 0 }
        return Double(currentIndex) / Double(totalPoints - 1)
    }

    /// Whether we're at the end of the playback
    public var isAtEnd: Bool {
        currentIndex >= totalPoints - 1
    }

    /// Whether we're at the beginning
    public var isAtStart: Bool {
        currentIndex == 0
    }

    // MARK: - Actions

    /// Toggles play/pause state
    public func togglePlayback() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    /// Starts playback
    public func play() {
        guard totalPoints > 0 else { return }

        if isAtEnd {
            currentIndex = 0
        }
        isPlaying = true
        startEngine()
    }

    /// Pauses playback
    public func pause() {
        engine.stop()
        isPlaying = false
    }

    /// Resets playback to the beginning
    public func reset() {
        engine.stop()
        isPlaying = false
        currentIndex = 0
    }

    // MARK: - Private Engine Control

    private func startEngine() {
        engine.start(
            from: currentIndex,
            totalPoints: totalPoints,
            speed: speed.rawValue,
            onUpdate: { [weak self] index in
                guard let self = self else { return }
                let now = CFAbsoluteTimeGetCurrent()
                // Throttle @Observable updates to ~10fps to reduce SwiftUI churn
                // The engine still runs at 60fps internally for smooth seeking
                if now - self.lastUpdateTime >= self.updateInterval {
                    self.lastUpdateTime = now
                    self.currentIndex = index
                }
            },
            onComplete: { [weak self] in
                guard let self = self else { return }
                // Always update to final position on complete
                self.currentIndex = max(0, self.totalPoints - 1)
                self.isPlaying = false
            }
        )
    }

    /// Jumps to a specific index
    public func seek(to index: Int) {
        currentIndex = max(0, min(index, totalPoints - 1))
        if isPlaying {
            engine.setCurrentIndex(currentIndex)
        }
    }

    /// Jumps to a specific progress (0-1)
    public func seekToProgress(_ progress: Double) {
        guard totalPoints > 1 else { return }
        let targetIndex = Int(progress * Double(totalPoints - 1))
        seek(to: targetIndex)
    }

    /// Advances playback by the given number of points
    public func advance(by points: Int) {
        let newIndex = currentIndex + points
        if newIndex >= totalPoints {
            currentIndex = totalPoints - 1
            isPlaying = false
            engine.stop()
        } else {
            currentIndex = newIndex
        }
    }

    /// Sets playback speed
    public func setSpeed(_ newSpeed: PlaybackSpeed) {
        speed = newSpeed
        if isPlaying {
            engine.setSpeed(newSpeed.rawValue)
        }
    }

    /// Cycles through playback speeds
    public func cycleSpeed() {
        let speeds = PlaybackSpeed.allCases
        guard let currentIdx = speeds.firstIndex(of: speed),
              currentIdx < speeds.count - 1 else {
            setSpeed(speeds[0])
            return
        }
        setSpeed(speeds[currentIdx + 1])
    }

    /// Updates total points (call when simulation data changes)
    public func setTotalPoints(_ count: Int) {
        totalPoints = count
        if currentIndex >= count {
            currentIndex = max(0, count - 1)
        }
    }
}
