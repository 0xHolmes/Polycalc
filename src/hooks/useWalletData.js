import { useState, useCallback } from "react";

const BASE = "/.netlify/functions";

export function useWalletData() {
  const [status,   setStatus]   = useState("idle");
  const [messages, setMessages] = useState([]);
  const [data,     setData]     = useState(null);

  const fetchWallet = useCallback(async (address) => {
    const addr = address?.trim();
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setStatus("error");
      setMessages(["Invalid address — must be 0x followed by 40 hex characters"]);
      return;
    }

    setStatus("loading");
    setMessages([]);
    setData(null);

    const results = {};
    const log     = [];

    // ── 1. Profile (derived from activity)
    try {
      const res  = await fetch(`${BASE}/profile?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      results.profile = json;
      log.push(`✓ Profile: ${json.pseudonym ?? json.name ?? addr.slice(0, 8) + "…"}`);
    } catch (e) {
      results.profile = null;
      log.push(`✗ Profile: ${e.message}`);
    }

    // ── 2. Volume (summed from TRADE activity — reliable)
    try {
      const res  = await fetch(`${BASE}/traded?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      // Response: { volumeTraded, tradeCount, earliestTradeTimestamp }
      results.volumeTraded          = Number(json.volumeTraded ?? 0);
      results.tradeCount            = Number(json.tradeCount ?? 0);
      results.earliestTradeTimestamp = json.earliestTradeTimestamp ?? null;

      log.push(`✓ Volume: $${results.volumeTraded.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${results.tradeCount} trades)`);
    } catch (e) {
      results.volumeTraded = null;
      log.push(`✗ Volume: ${e.message}`);
    }

    // ── 3. Portfolio value + PnL (from positions)
    try {
      const res  = await fetch(`${BASE}/value?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      // Response: { portfolioValue, cashPnl, positionCount }
      results.portfolioValue = Number(json.portfolioValue ?? 0);
      results.cashPnl        = Number(json.cashPnl        ?? json.portfolioValue ?? 0);
      results.positionCount  = Number(json.positionCount  ?? 0);

      log.push(`✓ Portfolio: $${results.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} | PnL: $${results.cashPnl.toFixed(2)}`);
    } catch (e) {
      results.portfolioValue = null;
      results.cashPnl        = null;
      log.push(`✗ Portfolio: ${e.message}`);
    }

    // ── 4. LP Rewards (REWARD-type activity)
    try {
      const res  = await fetch(`${BASE}/activity?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      // Response: { totalLPRewards, rewardCount, earliestTimestamp, items }
      results.activity = {
        totalLP:   Number(json.totalLPRewards ?? 0),
        count:     Number(json.rewardCount    ?? 0),
        earliest:  json.earliestTimestamp     ?? null,
        items:     json.items                 ?? [],
      };

      log.push(`✓ LP rewards: $${results.activity.totalLP.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${results.activity.count} payouts)`);
    } catch (e) {
      results.activity = null;
      log.push(`✗ LP rewards: ${e.message}`);
    }

    // ── 5. Recent trades
    try {
      const res  = await fetch(`${BASE}/trades?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      results.trades = Array.isArray(json) ? json : [];
      log.push(`✓ Trades: ${results.trades.length} recent trades loaded`);
    } catch (e) {
      results.trades = [];
      log.push(`✗ Trades: ${e.message}`);
    }

    // ── Determine overall status
    const successes = log.filter((m) => m.startsWith("✓")).length;
    const failures  = log.filter((m) => m.startsWith("✗")).length;

    setMessages(log);
    setData(results);
    setStatus(failures === 0 ? "success" : successes === 0 ? "error" : "partial");
  }, []);

  return { status, messages, data, fetchWallet };
}
