import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from "recharts";

import { useWalletData } from "./hooks/useWalletData.js";
import {
  computeAirdrop, computeLPScores, computeSocialScore, lpOrderScore,
  fmtN, fmtUSD, fmtAddr,
} from "./lib/formulas.js";
import {
  C, Card, Lbl, Mono, Metric, MultTag, Toggle, Slider,
  TabBar, ScoreBar, TOOLTIP_STYLE,
} from "./components/UI.jsx";

// ─── LEADERBOARD MOCK DATA ────────────────────────────────────────────────────
const LB_BASE = Array.from({ length: 25 }, (_, i) => ({
  rank:      i + 1,
  wallet:    `0x${(0xabc000 + i * 17293).toString(16).padStart(6, "0")}…${(0xdef000 + i * 9871).toString(16).slice(-4)}`,
  volume:    Math.exp(Math.log(500_000_000) - i * 0.38 + Math.sin(i * 1.3) * 0.25),
  lpRewards: Math.exp(Math.log(200_000) - i * 0.42 + Math.cos(i * 1.1) * 0.2),
  isEarly:   i < 12,
  pnl:       i < 12 ? 1 : -1, // early wallets assumed profitable for demo
}));

const SCENARIOS = [
  { label: "Bear",  fdvV: 2e9,  color: C.red },
  { label: "Base",  fdvV: 10e9, color: C.amber },
  { label: "Bull",  fdvV: 25e9, color: C.green },
  { label: "Ultra", fdvV: 50e9, color: C.purple },
];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Navigation
  const [tab, setTab] = useState("checker");

  // ── Inputs
  const [walletInput,  setWalletInput]  = useState("");
  const [twitterInput, setTwitterInput] = useState("");

  // ── Wallet data hook
  const { status: fetchStatus, messages: fetchMessages, data: walletData, fetchWallet } = useWalletData();

  // ── Manual overrides
  const [manualVol,  setManualVol]  = useState(50000);
  const [manualPnL,  setManualPnL]  = useState(2500);
  const [manualLP,   setManualLP]   = useState(120);
  const [useManual,  setUseManual]  = useState(true); // true until first fetch

  // ── Eligibility (auto-set from fetch, overridable)
  const [isEarlyUser, setIsEarlyUser] = useState(false);
  const [isEarlyLP,   setIsEarlyLP]   = useState(false);

  // ── Tokenomics sliders
  const [totalSupply,  setTotalSupply]  = useState(1_000_000_000);
  const [airdropPct,   setAirdropPct]   = useState(10);
  const [fdv,          setFdv]          = useState(10_000_000_000);
  const [lpAllocPct,   setLpAllocPct]   = useState(30);
  const [totalPlatVol, setTotalPlatVol] = useState(15_000_000_000);
  const [totalPlatLP,  setTotalPlatLP]  = useState(50_000_000);

  // ── LP calculator
  const [lpV,    setLpV]    = useState(3);
  const [lpSBid, setLpSBid] = useState(1);
  const [lpSAsk, setLpSAsk] = useState(1.2);
  const [lpBid,  setLpBid]  = useState(200);
  const [lpAsk,  setLpAsk]  = useState(200);
  const [lpMid,  setLpMid]  = useState(0.50);

  // ── Derived data values
  const profile     = walletData?.profile   ?? null;
  const fetchedVol  = walletData?.traded    ?? null;
  const fetchedPnL  = walletData?.value     ?? null;
  const fetchedLP   = walletData?.activity?.totalLP ?? null;
  const recentTrades = walletData?.trades   ?? [];

  const userVolume    = (!useManual && fetchedVol !== null)  ? fetchedVol  : manualVol;
  const userPnL       = (!useManual && fetchedPnL !== null)  ? fetchedPnL  : manualPnL;
  const userLPRewards = (!useManual && fetchedLP  !== null)  ? fetchedLP   : manualLP;

  // ── Main airdrop result
  const result = useMemo(() => computeAirdrop({
    userVolume, userPnL, userLPRewards,
    totalPlatformVol: totalPlatVol,
    totalPlatformLP:  totalPlatLP,
    totalSupply, airdropPct, fdv, lpAllocPct,
    isEarlyUser, isEarlyLP,
  }), [userVolume, userPnL, userLPRewards, totalPlatVol, totalPlatLP,
       totalSupply, airdropPct, fdv, lpAllocPct, isEarlyUser, isEarlyLP]);

  // ── Social score
  const socialScore = useMemo(() => {
    const handle = twitterInput.trim() || profile?.twitterUsername || "";
    return handle ? computeSocialScore(handle, profile) : null;
  }, [twitterInput, profile]);

  // ── Scenarios
  const scenarios = useMemo(() => SCENARIOS.map((s) => {
    const r = computeAirdrop({
      userVolume, userPnL, userLPRewards,
      totalPlatformVol: totalPlatVol, totalPlatformLP: totalPlatLP,
      totalSupply, airdropPct, fdv: s.fdvV, lpAllocPct, isEarlyUser, isEarlyLP,
    });
    return { ...s, price: s.fdvV / totalSupply, poly: r.rawTotal, usd: r.usdValue };
  }), [userVolume, userPnL, userLPRewards, totalPlatVol, totalPlatLP,
       totalSupply, airdropPct, lpAllocPct, isEarlyUser, isEarlyLP]);

  // ── Leaderboard
  const lbData = useMemo(() => LB_BASE.map((row) => {
    const r = computeAirdrop({
      userVolume: row.volume, userPnL: row.pnl, userLPRewards: row.lpRewards,
      totalPlatformVol: totalPlatVol, totalPlatformLP: totalPlatLP,
      totalSupply, airdropPct, fdv, lpAllocPct,
      isEarlyUser: row.isEarly, isEarlyLP: row.isEarly,
    });
    return { ...row, estPoly: r.rawTotal, estUSD: r.usdValue, mult: r.mult };
  }), [totalPlatVol, totalPlatLP, totalSupply, airdropPct, fdv, lpAllocPct]);

  // ── LP calculator
  const lpResult = useMemo(() => computeLPScores({
    maxSpread: lpV, bidSpread: lpSBid, askSpread: lpSAsk,
    bidSize: lpBid, askSize: lpAsk, midpoint: lpMid,
  }), [lpV, lpSBid, lpSAsk, lpBid, lpAsk, lpMid]);

  const spreadCurve = useMemo(() =>
    Array.from({ length: 31 }, (_, i) => {
      const s = (i / 30) * lpV;
      return { s: s.toFixed(1), score: (lpOrderScore(lpV, s, 1) * 100).toFixed(1) };
    }), [lpV]);

  // ── Emission chart
  const emitData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      month: `M${i + 1}`,
      circ: Math.round(totalSupply * (0.20 + 0.80 * (1 - Math.exp(-(i + 1) * 0.22)))),
    })), [totalSupply]);

  // ── Handle fetch
  const handleFetch = useCallback(async () => {
    const addr = walletInput.trim();
    await fetchWallet(addr);
    // After fetch, auto-switch to API data
    setUseManual(false);
    // Auto-detect eligibility from activity data
    // (handled in useWalletData, we read back from walletData)
  }, [walletInput, fetchWallet]);

  // Auto-sync eligibility from fetched data
  useMemo(() => {
    if (!walletData?.activity) return;
    const earliest = walletData.activity.earliestTimestamp;
    if (earliest) {
      setIsEarlyUser(new Date(earliest * 1000) < new Date("2025-01-01"));
    }
    setIsEarlyLP((walletData.activity.totalLP ?? 0) >= 1);
  }, [walletData]);

  // ── Pie
  const pieData = [
    { name: "Trading", value: result.tradingAlloc, color: C.blue },
    { name: "LP",      value: result.lpAlloc,      color: C.teal },
  ];

  const TABS = [
    { id: "checker",     label: "Airdrop Checker" },
    { id: "social",      label: "Social Score" },
    { id: "lpscore",     label: "LP Calculator" },
    { id: "simulator",   label: "Tokenomics" },
    { id: "scenarios",   label: "Scenarios" },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  const statusColor = { idle: C.muted, loading: C.amber, partial: C.amber, success: C.green, error: C.red }[fetchStatus] ?? C.muted;
  const statusIcon  = { idle: "○", loading: "↻", partial: "◑", success: "✓", error: "✗" }[fetchStatus] ?? "○";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, fontWeight: 700, color: "#fff" }}>P</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Syne'", fontSize: 16, fontWeight: 800, letterSpacing: 1, color: "#e8f4ff" }}>
                POLY<span style={{ color: C.green }}>CALC</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, color: C.muted, letterSpacing: 1 }}>
                AIRDROP SIMULATOR
              </div>
            </div>
          </div>

          {/* Tabs */}
          <TabBar tabs={TABS} active={tab} onSelect={setTab} />

          {/* Status */}
          <Mono size={9} color={statusColor} style={{ flexShrink: 0 }}>
            <span className={fetchStatus === "loading" ? "spin" : ""}>{statusIcon}</span>
            {" "}{fetchStatus.toUpperCase()}
          </Mono>
        </div>
      </header>

      {/* ── DISCLAIMER ─────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: "#0a0e16", padding: "4px 24px", textAlign: "center" }}>
        <Mono size={9} color={`${C.muted}88`}>
          ⚠ Community simulation. Formulas from polyield.xyz & Polymarket official docs. Not affiliated with Polymarket. Not financial advice.
        </Mono>
      </div>

      {/* ── WALLET + TWITTER INPUT BAR ──────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, padding: "14px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>

          {/* Input row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Wallet */}
            <div style={{ flex: "2 1 280px" }}>
              <Lbl>Polymarket Wallet Address</Lbl>
              <input
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="0x6af75d4e4aaf700450efbac3708cce1665810ff1"
              />
            </div>

            {/* Twitter */}
            <div style={{ flex: "1 1 180px" }}>
              <Lbl>Twitter / X Handle <span style={{ color: C.dimmed }}>(optional)</span></Lbl>
              <input
                type="text"
                value={twitterInput}
                onChange={(e) => setTwitterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="@yourhandle"
              />
            </div>

            {/* Fetch button */}
            <div style={{ flexShrink: 0 }}>
              <button
                onClick={handleFetch}
                disabled={fetchStatus === "loading"}
                style={{
                  background: `linear-gradient(135deg, ${C.green}33, ${C.teal}22)`,
                  border: `1px solid ${C.green}66`, color: C.green,
                  borderRadius: 7, padding: "10px 22px",
                  fontFamily: "'Syne'", fontSize: 12, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: "uppercase",
                  opacity: fetchStatus === "loading" ? 0.5 : 1, cursor: fetchStatus === "loading" ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {fetchStatus === "loading"
                  ? <span className="pulse">FETCHING…</span>
                  : "FETCH & ESTIMATE"}
              </button>
            </div>
          </div>

          {/* Profile strip */}
          {profile && (
            <div style={{
              marginTop: 10, display: "flex", alignItems: "center", gap: 12,
              padding: "8px 12px", background: C.card, borderRadius: 8,
              border: `1px solid ${C.border}`,
            }}>
              {profile.profileImageOptimized && (
                <img
                  src={profile.profileImageOptimized}
                  alt="" width={28} height={28}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                  onError={(e) => (e.target.style.display = "none")}
                />
              )}
              <Mono size={12} color={C.green}>{fmtAddr(walletInput)}</Mono>
              {profile.name && <Mono size={12} color={C.text}>{profile.name}</Mono>}
              {profile.pseudonym && <Mono size={11} color={C.muted}>@{profile.pseudonym}</Mono>}
              {profile.twitterUsername && (
                <span style={{
                  fontFamily: "'IBM Plex Mono'", fontSize: 10, color: C.teal,
                  padding: "2px 7px", background: `${C.teal}11`,
                  borderRadius: 3, border: `1px solid ${C.teal}33`,
                }}>
                  𝕏 @{profile.twitterUsername}
                </span>
              )}
            </div>
          )}

          {/* Fetch log */}
          {fetchMessages.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {fetchMessages.map((m, i) => {
                const ok = m.startsWith("✓");
                return (
                  <span key={i} style={{
                    fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: "2px 8px",
                    borderRadius: 3,
                    background: ok ? `${C.green}11` : `${C.red}11`,
                    border: `1px solid ${ok ? C.green : C.red}33`,
                    color: ok ? C.green : C.red,
                  }}>
                    {m}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px 60px" }}>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: AIRDROP CHECKER
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "checker" && (
          <div className="fu">

            {/* Data inputs */}
            <Card accent={C.dimmed} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Syne'", fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {fetchedVol !== null && !useManual
                    ? "Live On-Chain Data (Polymarket APIs)"
                    : "Manual Input — Enter Your Stats"}
                </div>
                {fetchedVol !== null && (
                  <button
                    onClick={() => setUseManual(!useManual)}
                    style={{
                      background: "transparent", border: `1px solid ${C.border2}`,
                      color: C.muted, borderRadius: 5, padding: "5px 12px",
                      fontFamily: "'Syne'", fontSize: 10, letterSpacing: 1,
                    }}
                  >
                    {useManual ? "← Use API data" : "Override manually →"}
                  </button>
                )}
              </div>

              <div className="g3">
                {/* Volume */}
                <div>
                  <Lbl>
                    Trading Volume (USD){" "}
                    {fetchedVol !== null && !useManual && (
                      <span style={{ color: C.green }}>● live</span>
                    )}
                  </Lbl>
                  <input
                    type="number"
                    value={useManual ? manualVol : (fetchedVol ?? manualVol)}
                    disabled={!useManual && fetchedVol !== null}
                    onChange={(e) => setManualVol(Number(e.target.value))}
                  />
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginTop: 3 }}>
                    {fetchedVol !== null
                      ? `API returned: ${fmtUSD(fetchedVol)}`
                      : "Your total trading volume on Polymarket"}
                  </div>
                </div>

                {/* PnL */}
                <div>
                  <Lbl>
                    Portfolio Value / PnL (USD){" "}
                    {fetchedPnL !== null && !useManual && (
                      <span style={{ color: C.green }}>● live</span>
                    )}
                  </Lbl>
                  <input
                    type="number"
                    value={useManual ? manualPnL : (fetchedPnL ?? manualPnL)}
                    disabled={!useManual && fetchedPnL !== null}
                    onChange={(e) => setManualPnL(Number(e.target.value))}
                  />
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginTop: 3 }}>
                    {fetchedPnL !== null
                      ? `API returned: ${fmtUSD(fetchedPnL)}`
                      : "Positive value = profitable trader (1.25× multiplier)"}
                  </div>
                </div>

                {/* LP Rewards */}
                <div>
                  <Lbl>
                    LP Rewards Earned (USD){" "}
                    {fetchedLP !== null && !useManual && (
                      <span style={{ color: C.green }}>● live</span>
                    )}
                  </Lbl>
                  <input
                    type="number"
                    value={useManual ? manualLP : (fetchedLP ?? manualLP)}
                    disabled={!useManual && fetchedLP !== null}
                    onChange={(e) => setManualLP(Number(e.target.value))}
                  />
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginTop: 3 }}>
                    {fetchedLP !== null
                      ? `API: ${fmtUSD(fetchedLP)} from ${walletData?.activity?.count ?? 0} reward payouts`
                      : "Total USDC earned from Polymarket LP rewards"}
                  </div>
                </div>
              </div>

              {/* Eligibility toggles */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <Lbl>Eligibility Multipliers</Lbl>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
                  <Toggle label="Early User — active before Jan 2025 (1.5×)" checked={isEarlyUser} onChange={setIsEarlyUser} color={C.amber} />
                  <Toggle label="Early LP — ≥$1 LP rewards before Q2 2026 (1.25×)" checked={isEarlyLP} onChange={setIsEarlyLP} color={C.teal} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginTop: 6 }}>
                  Profitable Trader bonus (1.25×) is auto-applied when PnL/portfolio value is positive.
                </div>
              </div>
            </Card>

            {/* Results */}
            <div className="g2" style={{ marginBottom: 14 }}>

              {/* Allocation */}
              <Card accent={C.green}>
                <div style={{ fontFamily: "'Syne'", fontSize: 13, fontWeight: 700, color: C.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                  Estimated Allocation
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: 16, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, textAlign: "center" }}>
                    <Lbl>Total POLY</Lbl>
                    <Mono size={28} color={C.green}>{fmtN(result.rawTotal)}</Mono>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginTop: 2 }}>POLY tokens</div>
                  </div>
                  <div style={{ padding: 16, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, textAlign: "center" }}>
                    <Lbl>USD Value</Lbl>
                    <Mono size={28} color={C.amber}>{fmtUSD(result.usdValue)}</Mono>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginTop: 2 }}>
                      @ {fmtUSD(result.tokenPrice)}/POLY
                    </div>
                  </div>
                </div>
                <div className="g3">
                  <Metric label="From Trading" value={fmtN(result.tradingAlloc)} color={C.blue}
                    sub={`${(result.volShare * 100).toFixed(6)}% vol share`} size={14} />
                  <Metric label="From LP" value={fmtN(result.lpAlloc)} color={C.teal}
                    sub={`${(result.lpShare * 100).toFixed(6)}% LP share`} size={14} />
                  <Metric label="Multiplier" value={`${result.mult.toFixed(4)}×`} color={C.amber}
                    sub="combined" size={14} />
                </div>
              </Card>

              {/* Right col */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Multipliers */}
                <Card accent={C.amber}>
                  <Lbl>Multipliers (PolyYield exact values)</Lbl>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <MultTag label="Early User (active before Jan 2025)"  value="1.5×"  color={C.amber} active={result.earlyUser} />
                    <MultTag label="Profitable Trader (portfolio value > 0)" value="1.25×" color={C.green} active={result.profitable} />
                    <MultTag label="Early LP (≥$1 rewards, before Q2 2026)" value="1.25×" color={C.teal}  active={result.earlyLP} />
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 10px", background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Mono size={10} color={C.muted}>Max possible (all three)</Mono>
                      <Mono size={12} color={C.amber}>2.344×</Mono>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <Mono size={10} color={C.muted}>Your share of airdrop pool</Mono>
                      <Mono size={10} color={C.muted}>{(result.pctOfPool * 100).toFixed(6)}%</Mono>
                    </div>
                  </div>
                </Card>

                {/* Pie */}
                <Card accent={C.teal}>
                  <Lbl>Reward Split</Lbl>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie
                        data={pieData.filter((d) => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={52} innerRadius={28}
                        dataKey="value" strokeWidth={2} stroke={C.bg}
                      >
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtN(v) + " POLY", ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
                    {pieData.map((d) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <Mono size={10} color={C.muted}>{d.name}</Mono>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* Stats grid */}
            <div className="g4" style={{ marginBottom: 14 }}>
              {[
                { label: "Airdrop Pool",    value: fmtN(result.airdropPool) + " POLY",  color: C.green },
                { label: "Trading Pool",    value: fmtN(result.tradingPool) + " POLY",  color: C.blue },
                { label: "LP Pool",         value: fmtN(result.lpPool) + " POLY",       color: C.teal },
                { label: "Token Price",     value: fmtUSD(result.tokenPrice),            color: C.amber },
                { label: "Your Vol Share",  value: (result.volShare * 100).toFixed(6) + "%", color: C.blue },
                { label: "Your LP Share",   value: (result.lpShare * 100).toFixed(6) + "%",  color: C.teal },
                { label: "Platform Volume", value: fmtUSD(totalPlatVol),                 color: C.muted },
                { label: "Platform LP",     value: fmtUSD(totalPlatLP),                  color: C.muted },
              ].map((m) => <Metric key={m.label} {...m} size={14} />)}
            </div>

            {/* Recent trades */}
            {recentTrades.length > 0 && (
              <Card accent={C.blue} style={{ marginBottom: 14 }}>
                <Lbl>Recent Trades (live from Polymarket API)</Lbl>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 55px 80px 70px", gap: 8, padding: "0 6px 8px", borderBottom: `1px solid ${C.border}` }}>
                    {["Date", "Market", "Side", "Size", "Outcome"].map((h) => (
                      <Lbl key={h} style={{ marginBottom: 0 }}>{h}</Lbl>
                    ))}
                  </div>
                  {recentTrades.map((t, i) => (
                    <div key={i} style={{
                      display: "grid", gridTemplateColumns: "80px 1fr 55px 80px 70px",
                      gap: 8, padding: "7px 6px", borderBottom: `1px solid ${C.border}55`,
                    }}>
                      <Mono size={10} color={C.muted}>
                        {t.timestamp ? new Date(t.timestamp * 1000).toLocaleDateString() : "—"}
                      </Mono>
                      <Mono size={10} color={C.text} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title || "—"}
                      </Mono>
                      <Mono size={10} color={t.side === "BUY" ? C.green : C.red}>{t.side || "—"}</Mono>
                      <Mono size={10} color={C.amber}>{t.usdcSize ? fmtUSD(t.usdcSize) : "—"}</Mono>
                      <Mono size={10} color={C.muted}>{t.outcome || "—"}</Mono>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Formula reference */}
            <Card accent={C.dimmed}>
              <Lbl>Formula Reference — PolyYield (polyield.xyz/checker)</Lbl>
              <div style={{
                fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.muted,
                lineHeight: 2, padding: "10px 12px", background: C.surface,
                borderRadius: 6, border: `1px solid ${C.border}`,
              }}>
                <span style={{ color: C.blue }}>trading_alloc</span>
                {" = (user_volume / platform_total_volume) × (airdrop_pool × trading_pct)"}<br />
                <span style={{ color: C.teal }}>lp_alloc</span>
                {" = (user_lp_rewards / platform_total_lp) × (airdrop_pool × lp_pct)"}<br />
                <span style={{ color: C.amber }}>multiplier</span>
                {" : early_user×1.5 · profitable_pnl×1.25 · early_lp×1.25"}<br />
                <span style={{ color: C.green }}>total_poly</span>
                {" = (trading_alloc + lp_alloc) × multiplier"}
              </div>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: SOCIAL SCORE
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "social" && (
          <div className="fu">
            {!socialScore ? (
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>𝕏</div>
                <div style={{ fontFamily: "'Syne'", fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 10 }}>
                  Social Influence Score
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: C.muted, maxWidth: 460, margin: "0 auto", lineHeight: 1.8 }}>
                  Enter your Twitter/X handle in the input bar above.<br /><br />
                  Polymarket has confirmed that linking your X account may factor into airdrop eligibility. This tab generates a PolyTweet-inspired estimate of your social influence score.
                </div>
              </div>
            ) : (
              <>
                <div className="g2" style={{ marginBottom: 14 }}>
                  <Card accent={C.pink}>
                    <div style={{ fontFamily: "'Syne'", fontSize: 13, fontWeight: 700, color: C.pink, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                      Social Profile
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
                      padding: 12, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${C.blue}, ${C.pink})`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18, color: "#fff" }}>𝕏</span>
                      </div>
                      <div>
                        <Mono size={16} color={C.text}>{socialScore.handle}</Mono>
                        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: C.muted, marginTop: 3 }}>
                          {socialScore.twitterLinked
                            ? <span style={{ color: C.green }}>✓ Linked to Polymarket profile</span>
                            : "Link at polymarket.com/settings for eligibility"}
                        </div>
                      </div>
                    </div>
                    <div className="g2">
                      <Metric label="Influence Score"  value={socialScore.influenceScore.toFixed(1) + "/100"} color={C.pink} size={20} />
                      <Metric label="Promoter Score"   value={socialScore.promoterScore.toFixed(1) + "/100"} color={C.purple} size={20} />
                      <Metric label="Est. Followers"   value={socialScore.estFollowers.toLocaleString()} color={C.blue} size={14} />
                      <Metric label="Est. Mentions"    value={socialScore.estMentions.toLocaleString()} color={C.teal} size={14} />
                      <Metric label="Est. Impressions" value={fmtN(socialScore.estImpressions)} color={C.amber} size={14} />
                      <Metric label="Engagement Rate"  value={socialScore.engagementRate.toFixed(2) + "%"} color={C.green} size={14} />
                    </div>
                  </Card>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Card accent={C.purple}>
                      <Lbl>Score Breakdown</Lbl>
                      <ScoreBar label="Follower weight"   value={Math.min(100, Math.log10(socialScore.estFollowers + 1) * 18)} color={C.blue} />
                      <ScoreBar label="Engagement rate"   value={Math.min(100, socialScore.engagementRate * 8)} color={C.green} />
                      <ScoreBar label="Impression reach"  value={Math.min(100, Math.log10(socialScore.estImpressions + 1) * 5)} color={C.amber} />
                      <ScoreBar label="Mention frequency" value={Math.min(100, socialScore.estMentions / 20 * 30)} color={C.teal} />
                    </Card>

                    <Card accent={C.amber}>
                      <Lbl>Estimated Airdrop Impact</Lbl>
                      <Metric label="Social Bonus Pool %" value={(socialScore.poolBonusPct * 100).toFixed(4) + "%"} color={C.amber} size={15} sub="of total airdrop pool" style={{ marginBottom: 10 }} />
                      <Metric label="Est. Social POLY Bonus"
                        value={fmtN(result.airdropPool * socialScore.poolBonusPct)}
                        color={C.pink} size={15}
                        sub={"≈ " + fmtUSD(result.airdropPool * socialScore.poolBonusPct * result.tokenPrice)}
                      />
                    </Card>
                  </div>
                </div>

                <Card accent={C.dimmed}>
                  <Lbl>About This Score</Lbl>
                  <Mono size={10} color={C.muted}>
                    Scores are estimated locally using a deterministic algorithm seeded from your handle — no Twitter API calls are made (Twitter API requires paid access). Follower counts, impressions and engagement are estimated. For a real social analytics view, visit polytweet.com. Linking your X account at polymarket.com/settings is the only confirmed action that may affect real eligibility.
                  </Mono>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: LP CALCULATOR
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "lpscore" && (
          <div className="fu">
            <div className="g2" style={{ marginBottom: 14 }}>
              <Card accent={C.teal}>
                <div style={{ fontFamily: "'Syne'", fontSize: 13, fontWeight: 700, color: C.teal, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                  LP Order Parameters
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono'", fontSize: 10, color: C.muted,
                  padding: "8px 10px", background: C.surface, borderRadius: 6,
                  border: `1px solid ${C.border}`, marginBottom: 14, lineHeight: 1.9,
                }}>
                  Official Polymarket formula (docs.polymarket.com):<br />
                  <span style={{ color: C.teal }}>S(v, s) = ((v − s) / v)² × size</span><br />
                  <span style={{ color: C.muted }}>v = max_spread · s = your spread from midpoint · sampled every 1 min (10,080/epoch)</span>
                </div>
                <Slider label="Max Spread v (cents)"       value={lpV}    min={0.5}  max={10}    step={0.5} fmt={(v) => v + "¢"}            onChange={setLpV}    color={C.teal} />
                <Slider label="Your Bid Spread s (cents)"  value={lpSBid} min={0}    max={lpV}   step={0.1} fmt={(v) => v.toFixed(1) + "¢"} onChange={(v) => setLpSBid(Math.min(v, lpV))} color={C.blue} />
                <Slider label="Your Ask Spread s (cents)"  value={lpSAsk} min={0}    max={lpV}   step={0.1} fmt={(v) => v.toFixed(1) + "¢"} onChange={(v) => setLpSAsk(Math.min(v, lpV))} color={C.blue} />
                <Slider label="Bid Size (shares)"          value={lpBid}  min={10}   max={5000}  step={10}  fmt={(v) => v.toLocaleString()}  onChange={setLpBid}  color={C.amber} />
                <Slider label="Ask Size (shares)"          value={lpAsk}  min={10}   max={5000}  step={10}  fmt={(v) => v.toLocaleString()}  onChange={setLpAsk}  color={C.amber} />
                <Slider label="Market Midpoint"            value={lpMid}  min={0.01} max={0.99}  step={0.01} fmt={(v) => (v * 100).toFixed(0) + "¢"} onChange={setLpMid} color={C.purple} />
                <div style={{
                  fontFamily: "'IBM Plex Mono'", fontSize: 9, marginTop: 4,
                  color: (lpMid < 0.10 || lpMid > 0.90) ? C.red : C.muted,
                }}>
                  {lpMid < 0.10 || lpMid > 0.90
                    ? "⚠ Midpoint outside [10¢, 90¢] — must be two-sided to score"
                    : "Midpoint in [10¢, 90¢] — single-sided orders score at 1/3×"}
                </div>
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Card accent={C.green}>
                  <div style={{ fontFamily: "'Syne'", fontSize: 13, fontWeight: 700, color: C.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                    Score Results
                  </div>
                  <div className="g2">
                    <Metric label="Bid Score" value={lpOrderScore(lpV, lpSBid, lpBid).toFixed(3)} color={C.blue}
                      sub={`S(${lpV}, ${lpSBid}) × ${lpBid}`} size={16} />
                    <Metric label="Ask Score" value={lpOrderScore(lpV, lpSAsk, lpAsk).toFixed(3)} color={C.teal}
                      sub={`S(${lpV}, ${lpSAsk}) × ${lpAsk}`} size={16} />
                    <Metric label="Qone" value={lpResult.Qone.toFixed(3)} color={C.text} sub="first side" size={16} />
                    <Metric label="Qtwo" value={lpResult.Qtwo.toFixed(3)} color={C.text} sub="second side" size={16} />
                    <Metric label="Qmin (per sample)" value={lpResult.Qmin.toFixed(3)} color={C.green} size={18} />
                    <Metric label="Epoch Score"       value={fmtN(lpResult.epochScore)} color={C.amber}
                      sub="× 10,080 samples" size={18} />
                  </div>
                  <div style={{
                    marginTop: 12, padding: "10px 12px", background: C.surface,
                    borderRadius: 8, border: `1px solid ${C.border}`,
                    fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.muted, lineHeight: 2,
                  }}>
                    Bid: S({lpV}, {lpSBid}) = (({lpV}−{lpSBid})/{lpV})² × {lpBid} = <span style={{ color: C.blue }}>{lpOrderScore(lpV, lpSBid, lpBid).toFixed(4)}</span><br />
                    Ask: S({lpV}, {lpSAsk}) = (({lpV}−{lpSAsk})/{lpV})² × {lpAsk} = <span style={{ color: C.teal }}>{lpOrderScore(lpV, lpSAsk, lpAsk).toFixed(4)}</span><br />
                    Epoch = Qmin × 10,080 = <span style={{ color: C.amber }}>{fmtN(lpResult.epochScore)}</span>
                  </div>
                </Card>

                <Card accent={C.blue}>
                  <Lbl>Quadratic Decay — Score vs Spread</Lbl>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={spreadCurve} margin={{ top: 5, right: 5, left: 0, bottom: 16 }}>
                      <XAxis dataKey="s" tick={{ fill: C.muted, fontSize: 9, fontFamily: "'IBM Plex Mono'" }}
                        label={{ value: "spread from midpoint (¢)", fill: C.muted, fontSize: 9, position: "insideBottom", offset: -8 }} />
                      <YAxis tick={{ fill: C.muted, fontSize: 9, fontFamily: "'IBM Plex Mono'" }} tickFormatter={(v) => v + "%"} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v + "%", "Score efficiency"]} labelFormatter={(v) => `${v}¢ spread`} />
                      <Line type="monotone" dataKey="score" stroke={C.teal} strokeWidth={2} dot={false} />
                      <ReferenceLine x={String(lpSBid.toFixed(1))} stroke={C.blue}  strokeDasharray="3 3" label={{ value: "bid", fill: C.blue,  fontSize: 9, fontFamily: "'IBM Plex Mono'" }} />
                      <ReferenceLine x={String(lpSAsk.toFixed(1))} stroke={C.amber} strokeDasharray="3 3" label={{ value: "ask", fill: C.amber, fontSize: 9, fontFamily: "'IBM Plex Mono'" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: TOKENOMICS SIMULATOR
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "simulator" && (
          <div className="fu">
            <div className="g2" style={{ marginBottom: 14 }}>
              <Card accent={C.green}>
                <div style={{ fontFamily: "'Syne'", fontSize: 13, fontWeight: 700, color: C.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
                  Tokenomics Parameters
                </div>
                <Slider label="Total Token Supply"      value={totalSupply}  min={100_000_000}     max={10_000_000_000}  step={100_000_000}   fmt={(v) => fmtN(v) + " POLY"} onChange={setTotalSupply}  color={C.green} />
                <Slider label="Airdrop Allocation %"    value={airdropPct}   min={2}               max={30}              step={0.5}            fmt={(v) => v.toFixed(1) + "%"} onChange={setAirdropPct}   color={C.blue} />
                <Slider label="Fully Diluted Valuation" value={fdv}          min={500_000_000}     max={100_000_000_000} step={500_000_000}    fmt={(v) => fmtUSD(v)}          onChange={setFdv}          color={C.amber} />
                <Slider label="LP Pool % of Airdrop"   value={lpAllocPct}   min={10}              max={60}              step={5}              fmt={(v) => v + "%"}            onChange={setLpAllocPct}   color={C.teal} />
                <Slider label="Total Platform Volume"   value={totalPlatVol} min={1_000_000_000}   max={50_000_000_000}  step={500_000_000}    fmt={(v) => fmtUSD(v)}          onChange={setTotalPlatVol} color={C.purple} />
                <Slider label="Platform LP Rewards"     value={totalPlatLP}  min={1_000_000}       max={500_000_000}     step={1_000_000}      fmt={(v) => fmtUSD(v)}          onChange={setTotalPlatLP}  color={C.red} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {[
                    { l: "Conservative", ts: 1e9, ap: 7,  f: 2e9,  lp: 25, pv: 10e9, pl: 20e6 },
                    { l: "Base Case",    ts: 1e9, ap: 10, f: 10e9, lp: 30, pv: 15e9, pl: 50e6 },
                    { l: "Bull Case",    ts: 5e8, ap: 15, f: 25e9, lp: 40, pv: 20e9, pl: 100e6 },
                  ].map((p) => (
                    <button key={p.l}
                      onClick={() => { setTotalSupply(p.ts); setAirdropPct(p.ap); setFdv(p.f); setLpAllocPct(p.lp); setTotalPlatVol(p.pv); setTotalPlatLP(p.pl); }}
                      style={{ padding: "5px 12px", borderRadius: 5, background: C.surface, border: `1px solid ${C.border2}`, color: C.muted, fontFamily: "'Syne'", fontSize: 10, letterSpacing: 1 }}
                    >
                      {p.l}
                    </button>
                  ))}
                </div>
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="g2">
                  {[
                    { label: "Token Price",  value: fmtUSD(result.tokenPrice),          color: C.amber },
                    { label: "Airdrop Pool", value: fmtN(result.airdropPool) + " POLY", color: C.green },
                    { label: "Trading Pool", value: fmtN(result.tradingPool) + " POLY", color: C.blue },
                    { label: "LP Pool",      value: fmtN(result.lpPool) + " POLY",      color: C.teal },
                    { label: "Your POLY",    value: fmtN(result.rawTotal),              color: C.green },
                    { label: "Your USD",     value: fmtUSD(result.usdValue),            color: C.amber },
                  ].map((m) => <Metric key={m.label} {...m} size={14} />)}
                </div>
                <Card accent={C.blue}>
                  <Lbl>Circulating Supply Curve</Lbl>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={emitData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.blue} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 9, fontFamily: "'IBM Plex Mono'" }} />
                      <YAxis tick={{ fill: C.muted, fontSize: 8, fontFamily: "'IBM Plex Mono'" }} tickFormatter={fmtN} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtN(v), "Circulating"]} />
                      <Area type="monotone" dataKey="circ" stroke={C.blue} fill="url(#eg)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: SCENARIOS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "scenarios" && (
          <div className="fu">
            <div className="g4" style={{ marginBottom: 14 }}>
              {scenarios.map((s) => (
                <Card key={s.label} accent={s.color}>
                  <div style={{ fontFamily: "'Syne'", fontSize: 16, fontWeight: 800, color: s.color, letterSpacing: 2, marginBottom: 8 }}>
                    {s.label.toUpperCase()}
                  </div>
                  <Mono size={20} color={s.color}>{fmtUSD(s.fdvV)}</Mono>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: C.muted, marginBottom: 12 }}>FDV</div>
                  <Metric label="Token Price" value={fmtUSD(s.price)} color={s.color} size={13} style={{ marginBottom: 8 }} />
                  <Metric label="Your POLY"   value={fmtN(s.poly)}    color={s.color} size={13} style={{ marginBottom: 8 }} />
                  <div style={{ padding: 10, background: `${s.color}0d`, borderRadius: 6, border: `1px solid ${s.color}33` }}>
                    <Lbl>Your USD</Lbl>
                    <Mono size={20} color={s.color}>{fmtUSD(s.usd)}</Mono>
                  </div>
                </Card>
              ))}
            </div>
            <Card accent={C.green}>
              <Lbl>Wallet Value by Scenario</Lbl>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scenarios.map((s) => ({ name: s.label, usd: s.usd }))} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11, fontFamily: "'Syne'" }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9, fontFamily: "'IBM Plex Mono'" }} tickFormatter={fmtUSD} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtUSD(v), "Wallet Value"]} />
                  <Bar dataKey="usd" radius={[4, 4, 0, 0]}>
                    {scenarios.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: LEADERBOARD
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "leaderboard" && (
          <div className="fu">
            <Card accent={C.green}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "'Syne'", fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  Community Estimate Leaderboard
                </div>
                <Mono size={9} color={C.muted}>PolyYield formula · updates with Tokenomics sliders</Mono>
              </div>

              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 110px 90px 50px", gap: 8, padding: "0 8px 8px", borderBottom: `1px solid ${C.border}` }}>
                {["#", "Wallet", "Volume", "LP Earned", "Est. POLY", "Est. USD", "Mult."].map((h) => (
                  <Lbl key={h} style={{ marginBottom: 0 }}>{h}</Lbl>
                ))}
              </div>

              {lbData.map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 110px 90px 50px",
                  gap: 8, padding: "9px 8px", borderRadius: 5,
                  background: i < 3 ? `${C.green}05` : "transparent",
                  borderBottom: `1px solid ${C.dimmed}55`,
                }}>
                  <Mono size={12} color={i === 0 ? C.amber : i < 3 ? C.muted : C.dimmed}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${row.rank}`}
                  </Mono>
                  <div>
                    <Mono size={11} color={C.text}>{row.wallet}</Mono>
                    {row.isEarly && (
                      <span style={{
                        fontFamily: "'IBM Plex Mono'", fontSize: 8, color: C.amber,
                        marginLeft: 6, padding: "1px 5px",
                        background: `${C.amber}18`, borderRadius: 3, border: `1px solid ${C.amber}33`,
                      }}>OG</span>
                    )}
                  </div>
                  <Mono size={11} color={C.blue}>{fmtUSD(row.volume)}</Mono>
                  <Mono size={11} color={C.teal}>{fmtUSD(row.lpRewards)}</Mono>
                  <Mono size={11} color={C.green}>{fmtN(row.estPoly)}</Mono>
                  <Mono size={11} color={C.amber}>{fmtUSD(row.estUSD)}</Mono>
                  <Mono size={10} color={C.muted}>{row.mult.toFixed(2)}×</Mono>
                </div>
              ))}
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}
