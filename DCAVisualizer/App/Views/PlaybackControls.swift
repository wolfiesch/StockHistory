import SwiftUI

/// Playback controls for the simulation animation
struct PlaybackControls: View {
    @Bindable var playbackStore: PlaybackStore

    var body: some View {
        VStack(spacing: 12) {
            // Progress slider
            Slider(
                value: Binding(
                    get: { playbackStore.progress },
                    set: { playbackStore.seekToProgress($0) }
                ),
                in: 0...1
            )
            .disabled(playbackStore.totalPoints <= 1)
            .accessibilityIdentifier("playbackSlider")

            HStack(spacing: 24) {
                // Reset button
                Button {
                    playbackStore.reset()
                } label: {
                    Image(systemName: "backward.end.fill")
                        .font(.title3)
                }
                .disabled(playbackStore.isAtStart)
                .accessibilityIdentifier("playbackResetButton")

                // Play/Pause button
                Button {
                    playbackStore.togglePlayback()
                } label: {
                    Image(systemName: playbackStore.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title)
                        .frame(width: 44, height: 44)
                        .background(Color.blue)
                        .foregroundStyle(.white)
                        .clipShape(Circle())
                }
                .accessibilityIdentifier("playbackToggleButton")

                // Speed buttons
                SpeedPicker(playbackStore: playbackStore)
            }

            // Progress text
            if playbackStore.totalPoints > 0 {
                Text("\(playbackStore.currentIndex + 1) / \(playbackStore.totalPoints) days")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .accessibilityIdentifier("playbackProgressLabel")
            }
        }
    }
}

// MARK: - Speed Picker

private struct SpeedPicker: View {
    var playbackStore: PlaybackStore

    var body: some View {
        Menu {
            ForEach(PlaybackStore.PlaybackSpeed.allCases) { speed in
                Button {
                    playbackStore.setSpeed(speed)
                } label: {
                    HStack {
                        Text(speed.label)
                        if speed == playbackStore.speed {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            Text(playbackStore.speed.label)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.secondary.opacity(0.2))
                .cornerRadius(16)
        }
        .accessibilityIdentifier("playbackSpeedMenu")
    }
}

#Preview {
    PlaybackControls(playbackStore: PlaybackStore())
        .padding()
}
