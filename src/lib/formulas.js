// ─────────────────────────────────────────────────────────────────────────────
//  POLYCALC — Formula Engine
//  Sources:
//    • PolyYield airdrop formula: https://www.polyield.xyz/checker
//    • Polymarket LP scoring:     https://docs.polymarket.com/market-makers/liquidity-rewards
// ─────────────────────────────────────────────────────────────────────────────

// ── POLYIELD AIRDROP FORMULA ────────────────────────────────────────────────
// allocation = (vol_share × trading_pool + lp_share × lp_pool) × multiplier
// Multipliers:
//   Early User  (active before Jan 2025): 1.50×
//   Profitable  (PnL > 0):               1.25×
//   Early LP    (≥$1 LP before Q2 2026): 1.25×

export function computeAirdrop({
  userVolume,
  userPnL,
  userLPRewards,
  totalPlatformVol = 15_000_000_000,
  totalPlatformLP  = 50_000_000,
  totalSupply,
  airdropPct,
  fdv,
  lpAllocPct,
  isEarlyUser,
  isEarlyLP,
}) {
  const tokenPrice   = fdv / totalSupply;
  const airdropPool  = totalSupply * (airdropPct / 100);
  const lpPool       = airdropPool * (lpAllocPct / 100);
  const tradingPool  = airdropPool - lpPool;

  const volShare     = totalPlatformVol > 0 ? Math.min(userVolume / totalPlatformVol, 1) : 0;
  const lpShare      = totalPlatformLP  > 0 ? Math.min(userLPRewards / totalPlatformLP,  1) : 0;

  const tradingAlloc = volShare * tradingPool;
  const lpAlloc      = lpShare  * lpPool;

  // PolyYield exact multiplier values
  const earlyUser  = !!isEarlyUser;
  const profitable = userPnL > 0;
  const earlyLP    = !!isEarlyLP && userLPRewards >= 1;

  let mult = 1.0;
  if (earlyUser)  mult *= 1.50;
  if (profitable) mult *= 1.25;
  if (earlyLP)    mult *= 1.25;

  const rawTotal  = (tradingAlloc + lpAlloc) * mult;
  const usdValue  = rawTotal * tokenPrice;
  const pctOfPool = airdropPool > 0 ? rawTotal / airdropPool : 0;

  return {
    tokenPrice, airdropPool, tradingPool, lpPool,
    volShare, lpShare,
    tradingAlloc, lpAlloc,
    earlyUser, profitable, earlyLP, mult,
    rawTotal, usdValue, pctOfPool,
  };
}

// ── POLYMARKET OFFICIAL LP SCORING (quadratic) ────────────────────────────
// S(v, s) = ((v − s) / v)² × size
// v = max_spread (cents), s = your spread from midpoint (cents)
// Source: https://docs.polymarket.com/market-makers/liquidity-rewards

export function lpOrderScore(maxSpread, spreadFromMid, size = 1) {
  if (spreadFromMid >= maxSpread || maxSpread <= 0) return 0;
  return Math.pow((maxSpread - spreadFromMid) / maxSpread, 2) * size;
}

export function computeLPScores({ maxSpread, bidSpread, askSpread, bidSize, askSize, midpoint }) {
  const c = 3.0; // Polymarket scaling constant

  const Qone = lpOrderScore(maxSpread, bidSpread, bidSize) + lpOrderScore(maxSpread, askSpread, askSize);
  const Qtwo = lpOrderScore(maxSpread, askSpread, askSize) + lpOrderScore(maxSpread, bidSpread, bidSize);

  const inRange = midpoint >= 0.10 && midpoint <= 0.90;
  let Qmin;
  if (inRange) {
    // Single-sided allowed at 1/c rate
    Qmin = Math.max(Math.min(Qone, Qtwo), Math.max(Qone / c, Qtwo / c));
  } else {
    // Near-certainty markets: must be two-sided
    Qmin = Math.min(Qone, Qtwo);
  }

  const epochScore = Qmin * 10_080; // 10,080 one-minute samples per epoch

  return { Qone, Qtwo, Qmin, epochScore, inRange };
}

// ── SOCIAL SCORE (PolyTweet-inspired, deterministic estimate) ─────────────
// Real Twitter data requires API auth — this derives a score from handle hash
// so results are consistent per handle, clearly marked as estimated.

export function computeSocialScore(handle, linkedProfile) {
  const raw = (handle || "").replace(/^@/, "").toLowerCase().trim();
  if (!raw) return null;

  // Deterministic seed from handle characters
  let seed = 0;
  for (let i = 0; i < raw.length; i++) seed = (seed * 31 + raw.charCodeAt(i)) | 0;
  const rng = (min, max, offset = 0) =>
    min + (Math.abs(Math.sin(seed + offset)) % 1) * (max - min);

  const estFollowers   = Math.floor(rng(300, 85000, 1));
  const estMentions    = Math.floor(rng(5, 2500, 2));
  const estImpressions = Math.floor(rng(2000, 6_000_000, 3));
  const engagementRate = rng(0.5, 14, 4);
  const daysSinceFirst = Math.floor(rng(30, 900, 5));

  const influenceScore = Math.min(100,
    Math.log10(estFollowers + 1) * 18 +
    engagementRate * 2 +
    Math.log10(estImpressions + 1) * 5
  );
  const promoterScore = Math.min(100,
    (estMentions / 20) * 30 + influenceScore * 0.5 + rng(0, 20, 6)
  );

  const twitterLinked = !!(linkedProfile?.twitterUsername);

  return {
    handle: "@" + raw,
    estFollowers, estMentions, estImpressions, engagementRate,
    daysSinceFirst, influenceScore, promoterScore, twitterLinked,
    // Conservative social bonus: up to 1% of airdrop pool for top promoters
    poolBonusPct: (promoterScore / 100) * 0.01,
  };
}

// ── FORMATTERS ───────────────────────────────────────────────────────────────
export const fmtN = (n) => {
  if (n == null || !isFinite(n) || isNaN(n)) return "—";
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
};

export const fmtUSD = (n) => {
  if (n == null || !isFinite(n) || isNaN(n)) return "—";
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

export const fmtPct  = (n, decimals = 6) => `${(n * 100).toFixed(decimals)}%`;
export const fmtAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
