# DCA Investment Visualizer

A Next.js application that visualizes how Dollar Cost Averaging (DCA) investments would have performed historically. See how recurring investments in any stock would have grown over time.

![DCA Visualizer](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Historical DCA Simulation** - Calculate how periodic investments would have performed
- **Dividend Reinvestment (DRIP)** - Toggle automatic dividend reinvestment
- **Multi-Stock Comparison** - Compare up to 3 tickers side-by-side
- **Animated Playback** - Watch your investment grow over time with play/pause controls
- **Real-time Metrics** - Total return, CAGR, shares owned, dividends earned
- **Export to CSV** - Download your simulation data
- **Shareable URLs** - Share your configuration with others

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- [EODHD API Key](https://eodhd.com/) (free tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/stock-history.git
cd stock-history

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
EODHD_API_KEY=your_api_key_here
```

Get your free API key at [eodhd.com](https://eodhd.com/).

### Development

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Run linting
pnpm lint

# Build for production
pnpm build
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

1. **Enter a Ticker Symbol** - Type any US stock ticker (e.g., AAPL, MSFT, SPY)
2. **Set Investment Amount** - Choose how much to invest per period ($1-$10,000)
3. **Select Frequency** - Weekly, biweekly, or monthly investments
4. **Pick Start Date** - Up to 30 years of historical data
5. **Toggle DRIP** - Enable/disable dividend reinvestment
6. **Add Comparisons** - Compare against other stocks (optional)
7. **Play Animation** - Watch your investment grow over time
8. **Export or Share** - Download CSV or copy shareable URL

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Charts**: Lightweight Charts (TradingView)
- **Testing**: Vitest + Testing Library

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/stock/         # API routes (history, dividends, validate)
│   ├── page.tsx           # Home page
│   └── providers.tsx      # React Query provider
├── components/
│   ├── chart/             # Chart and playback components
│   ├── config/            # Configuration panel
│   ├── summary/           # Metrics display
│   └── ui/                # Shared UI components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── api/              # API client and types
│   ├── calculation/      # DCA simulation engine
│   └── animation/        # Playback logic
└── store/                # Zustand stores
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stock/history` | Fetch historical price data |
| `GET /api/stock/dividends` | Fetch dividend history |
| `GET /api/stock/validate` | Validate ticker and get company name |

## Testing

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run
```

Tests cover the core DCA calculation engine including edge cases for dividends, date handling, and return calculations.

## Deployment

The app is configured for Vercel deployment:

```bash
# Deploy to Vercel
vercel
```

Set the `EODHD_API_KEY` environment variable in your Vercel project settings.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This tool is for educational and informational purposes only. Past performance does not guarantee future results. Always do your own research before making investment decisions.
