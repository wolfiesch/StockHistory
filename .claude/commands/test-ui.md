# Browser Automation UI Test

Run automated browser tests for the DCA Investment Visualizer. Takes screenshots at each checkpoint and reports pass/fail status.

**Usage**: `/test-ui` or `/test-ui MSFT` (with custom ticker)

---

## Instructions

Execute this test workflow using Playwright MCP browser automation tools. The default ticker is `AAPL` unless the user provides `$ARGUMENTS`.

### Pre-flight: Dev Server Check

1. Check if localhost:3000 is accessible:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000"
   ```

2. If NOT accessible (response != 200):
   - Start dev server in background: `pnpm dev` (run in background)
   - Wait 8 seconds for server startup
   - Verify it's now accessible

3. Clear old screenshots:
   ```bash
   rm -f test-artifacts/screenshots/*.png
   ```

---

### Test Workflow

Use these Playwright MCP tools for browser automation:
- `mcp__plugin_playwright_playwright__browser_navigate`
- `mcp__plugin_playwright_playwright__browser_take_screenshot`
- `mcp__plugin_playwright_playwright__browser_click`
- `mcp__plugin_playwright_playwright__browser_type`
- `mcp__plugin_playwright_playwright__browser_wait_for`
- `mcp__plugin_playwright_playwright__browser_press_key`
- `mcp__plugin_playwright_playwright__browser_snapshot`

**Important**: Use `ToolSearch` to load each tool before first use (e.g., `select:mcp__plugin_playwright_playwright__browser_navigate`).

Execute these steps in order, taking screenshots at each checkpoint:

| Step | Action | Screenshot Path | Pass Condition |
|------|--------|-----------------|----------------|
| 1 | Navigate to `http://localhost:3000` | `test-artifacts/screenshots/01-initial-load.png` | Page loads without error |
| 2 | Wait for heading "DCA Investment Visualizer" (10s timeout) | - | Heading visible |
| 3 | Find ticker input (`input[placeholder*="ticker"]` or `input[type="text"]`), clear it, type ticker | - | Input accepts text |
| 4 | Press Enter key | `test-artifacts/screenshots/02-ticker-entered.png` | Form submits |
| 5 | Wait for loading to complete - wait for skeleton to disappear OR for chart data (30s timeout) | - | Loading completes |
| 6 | Wait for legend text "Principal" to appear | `test-artifacts/screenshots/03-simulation-loaded.png` | Simulation data visible |
| 7 | Verify chart container exists (`canvas` or chart div) | `test-artifacts/screenshots/04-chart-rendered.png` | Chart renders |
| 8 | Click play button (look for play icon button, `button` with play icon, or `aria-label="Play"`) | - | Button clickable |
| 9 | Wait 2 seconds | `test-artifacts/screenshots/05-playback-running.png` | Animation progresses |
| 10 | Click pause button | `test-artifacts/screenshots/06-playback-paused.png` | Playback pauses |
| 11 | Click "2x" speed button | `test-artifacts/screenshots/07-speed-2x.png` | Speed changes |
| 12 | Click/drag scrubber to ~50% position (`input[type="range"]`) | `test-artifacts/screenshots/08-scrubber-test.png` | Scrubber moves |
| 13 | Click reset button (look for reset icon, `title="Reset"`, or reset text) | `test-artifacts/screenshots/09-after-reset.png` | Timeline resets |

---

### Element Selectors to Try

| Element | Primary Selector | Fallback Selectors |
|---------|-----------------|-------------------|
| Ticker input | `input[placeholder*="ticker"]` | `input[type="text"]`, `#ticker-input` |
| Play button | `button[aria-label="Play"]` | `button:has(svg)` with play icon, `.play-button` |
| Pause button | `button[aria-label="Pause"]` | same button as play (toggles) |
| Speed buttons | `button:has-text("2x")` | buttons in speed control group |
| Scrubber | `input[type="range"]` | `.scrubber`, `[role="slider"]` |
| Reset button | `button[title="Reset"]` | `button[aria-label="Reset"]`, button with reset icon |
| Chart | `canvas` | `div.recharts-wrapper`, `.chart-container` |
| Legend | `text=Principal` | `.recharts-legend`, legend element |

---

### Error Handling

- If any step fails, note the error and continue to remaining steps
- Take a screenshot even on failure (helps diagnose issues)
- Use `browser_snapshot` to get DOM state if click/find fails
- Maximum 3 retries per element before marking step as failed

---

### Output Format

After completing all steps, generate a summary:

```
## UI Test Results

**Ticker**: [ticker used]
**Dev Server**: [running/started]
**Test Time**: [timestamp]

### Step Results
| Step | Status | Notes |
|------|--------|-------|
| Initial Load | PASS/FAIL | [details] |
| Ticker Entry | PASS/FAIL | [details] |
| ... | ... | ... |

### Screenshots Captured
- test-artifacts/screenshots/01-initial-load.png
- test-artifacts/screenshots/02-ticker-entered.png
- ...

### Issues Found
- [List any failures or visual problems observed in screenshots]

### Recommended Fixes
- [Based on failures, suggest code fixes]
```

---

### Post-Test

After generating the report:
1. Read each screenshot file to visually analyze the UI state
2. Report any visual issues (blank charts, missing elements, layout problems)
3. If issues found, suggest specific code fixes
4. Offer to fix issues and re-run tests
