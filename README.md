# PolyCalc — POLY Airdrop Simulator

Community-generated simulation model. **Not affiliated with Polymarket.**

Formulas sourced from:
- [polyield.xyz/checker](https://www.polyield.xyz/checker) — airdrop allocation formula
- [docs.polymarket.com/market-makers/liquidity-rewards](https://docs.polymarket.com/market-makers/liquidity-rewards) — official LP scoring

---

## Quick Deploy (GitHub → Netlify)

### Step 1 — Install dependencies locally (optional, for testing)

You need [Node.js 18+](https://nodejs.org/) installed.

```bash
npm install
```

### Step 2 — Push to GitHub

```bash
# If you haven't already initialised git:
git init
git add .
git commit -m "initial commit"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/polycalc.git
git branch -M main
git push -u origin main
```

### Step 3 — Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect to **GitHub** and select your `polycalc` repository
3. Netlify auto-detects the `netlify.toml` — build settings are already correct:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Click **Deploy site**

That's it. Netlify handles the serverless functions automatically.

---

## Why Netlify Functions?

The Polymarket APIs (`data-api.polymarket.com`, `gamma-api.polymarket.com`) block direct browser requests via CORS. The Netlify Functions act as a server-side proxy — they call the APIs from the server and return the data to your browser, bypassing CORS entirely.

---

## Local Development

Install [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
npm install -g netlify-cli
netlify dev
```

This runs both the Vite dev server and the Netlify Functions together on `http://localhost:8888`.

---

## Project Structure

```
polycalc/
├── netlify/
│   └── functions/
│       ├── profile.js       # Proxy → gamma-api.polymarket.com/profiles
│       ├── traded.js        # Proxy → data-api.polymarket.com/traded
│       ├── value.js         # Proxy → data-api.polymarket.com/value
│       ├── activity.js      # Proxy → data-api.polymarket.com/activity (REWARD type)
│       └── trades.js        # Proxy → data-api.polymarket.com/trades
├── src/
│   ├── components/
│   │   └── UI.jsx           # Shared design-system components
│   ├── hooks/
│   │   └── useWalletData.js # Data fetching hook
│   ├── lib/
│   │   └── formulas.js      # PolyYield + Polymarket LP formulas
│   ├── App.jsx              # Main application
│   ├── main.jsx             # React entry point
│   └── index.css            # Global styles
├── index.html
├── vite.config.js
├── netlify.toml
└── package.json
```

---

## Features

- **Airdrop Checker** — Paste wallet address, fetches real on-chain data from Polymarket APIs
- **Social Score** — PolyTweet-inspired influence scoring from Twitter/X handle
- **LP Calculator** — Official Polymarket quadratic scoring formula `S(v,s) = ((v−s)/v)² × size`
- **Tokenomics Simulator** — Adjust supply, FDV, airdrop %, LP allocation with live recalculation
- **Scenarios** — Bear / Base / Bull / Ultra FDV projections
- **Leaderboard** — Community estimates using PolyYield formula
