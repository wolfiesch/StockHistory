# DCA Visualizer iOS App

A native iOS port of the DCA Investment Visualizer web application. This app allows users to visualize Dollar Cost Averaging (DCA) investment strategies with animated playback.

## Features

- **DCA Simulation**: Visualize dollar cost averaging for any stock ticker
- **Lump Sum Comparison**: Compare DCA vs lump sum investment strategies
- **Animated Playback**: Watch your investment grow over time with smooth animation
- **Dividend Handling**: Supports DRIP (reinvestment) and cash accumulation
- **Offline Support**: Cached data enables offline playback of previous simulations

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Project Structure

```
DCAVisualizer/
├── DCAKit/                    # Swift Package: Pure domain logic
│   ├── Models/                # Data models (PricePoint, SimulationResult, etc.)
│   ├── Engines/               # Simulation engines (DCA, LumpSum)
│   └── Tests/                 # Unit tests
├── StockHistoryAPI/           # Swift Package: Networking layer
│   ├── Client/                # API client (StockAPIClient)
│   ├── DTOs/                  # Response types
│   ├── Cache/                 # Offline caching
│   └── Errors/                # Error types
├── App/                       # iOS App Target
│   ├── Views/                 # SwiftUI views
│   ├── ViewModels/            # View models
│   ├── Stores/                # Observable state stores
│   └── Utilities/             # Playback engine
├── project.yml                # XcodeGen specification
└── README.md
```

## Setup

### Option 1: Using XcodeGen (Recommended)

1. Install XcodeGen:
   ```bash
   brew install xcodegen
   ```

2. Generate the Xcode project:
   ```bash
   cd DCAVisualizer
   xcodegen generate
   ```

3. Open the generated project:
   ```bash
   open DCAVisualizer.xcodeproj
   ```

### Option 2: Manual Xcode Project

1. Open Xcode and create a new iOS App project
2. Add the `DCAKit` and `StockHistoryAPI` packages as local dependencies
3. Copy the `App/` files into the project

## Configuration

### API URL

Update the API base URL in `App/DCAVisualizerApp.swift`:

```swift
private static let apiBaseURL = "https://your-app.vercel.app"
```

For development, you can use the local Next.js dev server:

```swift
#if DEBUG
private static let apiBaseURL = "http://localhost:3000"
#else
private static let apiBaseURL = "https://your-app.vercel.app"
#endif
```

## Architecture

### DCAKit Package

Pure-functional simulation logic with no external dependencies:

- **DCASimulator**: Runs dollar cost averaging simulations
- **LumpSumSimulator**: Runs lump sum investment simulations
- **InvestmentScheduleBuilder**: Maps scheduled investments to trading days

Key algorithm details:
- Dividends are processed BEFORE investments on the same day
- Non-trading days are resolved by searching up to 7 days forward
- CAGR uses 365.25 days/year for leap year accuracy

### StockHistoryAPI Package

Networking layer with caching support:

- **StockAPIClient**: Actor-based API client with rate limiting
- **SimulationCache**: Disk-based caching with TTL support
- Automatic retry with exponential backoff

### App Layer

SwiftUI views with @Observable state management:

- **ConfigStore**: User configuration state
- **SimulationStore**: Simulation results and loading state
- **PlaybackStore**: Animation playback state
- **PlaybackEngine**: CADisplayLink-based animation engine

## Testing

Run unit tests for DCAKit:

```bash
cd DCAKit
swift test
```

The test suite includes:
- DCA simulation accuracy tests
- Lump sum simulation tests
- Investment schedule builder tests
- Dividend handling tests
- Edge case coverage

## Key Insights

### Frame-Rate Independent Animation

The playback engine uses an accumulator pattern for smooth animation on both 60Hz and 120Hz (ProMotion) displays:

```swift
accumulator += deltaTime * pointsPerSecond
let pointsToAdvance = Int(accumulator)
accumulator -= Double(pointsToAdvance)
```

### Dividend Timing

Dividends must be processed BEFORE investments on the same trading day. This ensures you don't receive dividends on shares you just purchased.

### Fair DCA vs Lump Sum Comparison

When comparing strategies, the lump sum uses the same total investment as the DCA would have made, ensuring an apples-to-apples comparison.

## License

MIT License - See LICENSE file for details.
