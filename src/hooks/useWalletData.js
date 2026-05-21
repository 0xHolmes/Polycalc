import { useState, useCallback } from "react";

const BASE = "/.netlify/functions";

const isValidAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

async function safeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useWalletData() {
  const [status,   setStatus]   = useState("idle"); // idle | loading | partial | success | error
  const [messages, setMessages] = useState([]);
  const [data,     setData]     = useState(null);

  const addMsg = (msg) => setMessages((m) => [...m, msg]);

  const fetchWallet = useCallback(async (address) => {
    if (!address || !isValidAddress(address)) {
      setStatus("error");
      setMessages(["Invalid address — must start with 0x and be 42 characters long"]);
      return;
    }

    setStatus("loading");
    setMessages([]);
    setData(null);

    const addr = address.trim();
    const results = { profile: null, traded: null, value: null, activity: null, trades: null };
    const errors  = {};

    // ── 1. Profile
    try {
      const raw = await safeFetch(`${BASE}/profile?address=${addr}`);
      results.profile = Array.isArray(raw) ? raw[0] : raw;
      addMsg("✓ Profile loaded");
    } catch (e) {
      errors.profile = e.message;
      addMsg("✗ Profile: " + e.message);
    }

    // ── 2. Traded volume
    try {
      const raw = await safeFetch(`${BASE}/traded?address=${addr}`);
      results.traded = Number(raw?.volumeTraded ?? raw?.volume ?? 0);
      addMsg(`✓ Volume: $${results.traded.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
    } catch (e) {
      errors.traded = e.message;
      addMsg("✗ Volume: " + e.message);
    }

    // ── 3. Portfolio value (PnL proxy)
    try {
      const raw = await safeFetch(`${BASE}/value?address=${addr}`);
      results.value = Number(raw?.portfolioValue ?? raw?.value ?? 0);
      addMsg(`✓ Portfolio value: $${results.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
    } catch (e) {
      errors.value = e.message;
      addMsg("✗ Portfolio value: " + e.message);
    }

    // ── 4. LP Rewards (REWARD activity)
    try {
      const raw = await safeFetch(`${BASE}/activity?address=${addr}`);
      results.activity = {
        totalLP:   Number(raw.totalLPRewards ?? 0),
        count:     raw.rewardCount ?? 0,
        earliest:  raw.earliestTimestamp ?? null,
        items:     raw.items ?? [],
      };
      addMsg(`✓ LP rewards: $${results.activity.totalLP.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${results.activity.count} payouts)`);
    } catch (e) {
      errors.activity = e.message;
      addMsg("✗ LP rewards: " + e.message);
    }

    // ── 5. Recent trades
    try {
      const raw = await safeFetch(`${BASE}/trades?address=${addr}`);
      results.trades = raw;
      addMsg(`✓ Trades: ${raw.length} recent trades loaded`);
    } catch (e) {
      errors.trades = e.message;
      addMsg("✗ Trades: " + e.message);
    }

    const successCount = Object.values(results).filter(Boolean).length;

    if (successCount === 0) {
      setStatus("error");
    } else if (Object.keys(errors).length > 0) {
      setStatus("partial");
    } else {
      setStatus("success");
    }

    setData(results);
  }, []);

  return { status, messages, data, fetchWallet };
}
