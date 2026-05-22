// value.js — PnL via CASHFLOW REPLAY (matches Polymarket's official calculation)
// Source: polymarket-toolkit validates this at ~0.2% MAPE vs official /profit endpoint
// Method: sum all cash flows from activity:
//   BUY   → cash OUT (subtract usdcSize)
//   SELL  → cash IN  (add usdcSize)
//   REDEEM→ cash IN  (payout from resolved markets)
//   SPLIT/MERGE/CONVERSION → neutral (no cash flow)
// PnL = sells + redeems - buys + current portfolio value

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  // ── 1. Replay ALL activity to compute cash flows
  let totalBuys = 0, totalSells = 0, totalRedeems = 0;
  let activityCount = 0;
  let lastTimestamp = 0;

  try {
    let page = 0;
    while (page < 40) { // up to 20,000 activity items
      let url = `https://data-api.polymarket.com/activity?user=${addr}&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
      if (lastTimestamp > 0) url += `&start=${lastTimestamp}`;

      const res = await fetch(url, { headers });
      if (!res.ok) break;

      const batch = await res.json();
      const items = Array.isArray(batch) ? batch : [];
      if (items.length === 0) break;

      // Deduplicate items at the boundary timestamp
      const startIdx = (lastTimestamp > 0 && items.length > 0 && Number(items[0].timestamp) === lastTimestamp) ? 1 : 0;

      for (let i = startIdx; i < items.length; i++) {
        const item = items[i];
        const type = (item.type ?? "").toUpperCase();
        const usdc = Math.abs(Number(item.usdcSize ?? 0));

        if (type === "TRADE") {
          const side = (item.side ?? "").toUpperCase();
          if (side === "BUY")  totalBuys  += usdc;
          if (side === "SELL") totalSells += usdc;
        } else if (type === "REDEEM") {
          totalRedeems += usdc;
        }
        // SPLIT, MERGE, CONVERSION, REWARD → no direct cash PnL impact
        activityCount++;
      }

      const newTs = Number(items[items.length - 1]?.timestamp ?? 0);
      if (newTs <= lastTimestamp && items.length < 500) break;
      lastTimestamp = newTs;

      if (items.length < 500) break;
      page++;
    }
  } catch (_) {}

  // ── 2. Current portfolio value (unrealised)
  let portfolioValue = 0;
  let positionCount = 0;

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${addr}&sizeThreshold=0&limit=1000`, { headers }
    );
    if (res.ok) {
      const arr = await res.json();
      const items = Array.isArray(arr) ? arr : [];
      items.forEach(p => {
        portfolioValue += Number(p.currentValue ?? 0);
      });
      positionCount = items.length;
    }
  } catch (_) {}

  // ── 3. Compute PnL
  // Realised PnL = sells + redeems - buys (closed positions)
  // Total PnL = realised + unrealised (current portfolio value - remaining cost)
  // Simplified: PnL = (sells + redeems + portfolioValue) - buys
  const realizedPnl = totalSells + totalRedeems - totalBuys;
  const totalPnl = realizedPnl + portfolioValue;

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({
      totalPnl,
      realizedPnl,
      portfolioValue,
      totalBuys,
      totalSells,
      totalRedeems,
      activityCount,
      positionCount,
    }),
  };
};
