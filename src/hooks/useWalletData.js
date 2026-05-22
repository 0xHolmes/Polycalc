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

    const out = {};
    const log = [];

    // 1. Profile (from activity item)
    try {
      const res  = await fetch(`${BASE}/profile?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      out.profile = json;
      log.push(`✓ Profile: ${json.pseudonym ?? json.name ?? addr.slice(0,8)+"…"}`);
    } catch(e) { out.profile = null; log.push(`✗ Profile: ${e.message}`); }

    // 2. Volume + trade count (from TRADE activity, summing usdcSize)
    try {
      const res  = await fetch(`${BASE}/traded?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      out.volumeTraded           = Number(json.volumeTraded ?? 0);
      out.tradeCount             = Number(json.tradeCount   ?? 0);
      out.earliestTradeTimestamp = json.earliestTradeTimestamp ?? null;
      const pages = json.pagesLoaded ? `, ${json.pagesLoaded} pages` : "";
      log.push(`✓ Volume: $${out.volumeTraded.toLocaleString(undefined,{maximumFractionDigits:2})} (${out.tradeCount} trades${pages})`);
    } catch(e) { out.volumeTraded = null; log.push(`✗ Volume: ${e.message}`); }

    // 3. Portfolio + PnL (open positions + closed positions)
    try {
      const res  = await fetch(`${BASE}/value?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      out.portfolioValue = Number(json.portfolioValue ?? 0);
      out.cashPnl        = Number(json.cashPnl        ?? 0);
      out.realizedPnl    = Number(json.realizedPnl    ?? 0);
      out.totalPnl       = Number(json.totalPnl       ?? 0);
      out.positionCount  = Number(json.positionCount  ?? 0);
      out.closedCount    = Number(json.closedCount    ?? 0);
      log.push(`✓ Portfolio: $${out.portfolioValue.toFixed(2)} | PnL: $${out.totalPnl.toFixed(2)} (${out.positionCount} open + ${out.closedCount} closed)`);
    } catch(e) { out.portfolioValue = null; out.totalPnl = null; log.push(`✗ Portfolio: ${e.message}`); }

    // 4. LP rewards (REWARD-type activity)
    try {
      const res  = await fetch(`${BASE}/activity?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      out.activity = {
        totalLP:  Number(json.totalLPRewards ?? 0),
        count:    Number(json.rewardCount    ?? 0),
        earliest: json.earliestTimestamp     ?? null,
        items:    json.items                 ?? [],
      };
      log.push(`✓ LP rewards: $${out.activity.totalLP.toFixed(2)} (${out.activity.count} payouts)`);
    } catch(e) { out.activity = null; log.push(`✗ LP rewards: ${e.message}`); }

    // 5. Recent trades for display table
    try {
      const res  = await fetch(`${BASE}/trades?address=${addr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      out.trades = Array.isArray(json) ? json : [];
      log.push(`✓ Trades: ${out.trades.length} recent trades loaded`);
    } catch(e) { out.trades = []; log.push(`✗ Trades: ${e.message}`); }

    const ok = log.filter(m=>m.startsWith("✓")).length;
    setMessages(log);
    setData(out);
    setStatus(ok === 0 ? "error" : ok < log.length ? "partial" : "success");
  }, []);

  return { status, messages, data, fetchWallet };
}
