// value.js — PnL from ALL activity (TRADE + REDEEM + SPLIT + MERGE)
// The /profit and /value endpoints return incomplete data for many wallets.
// Correct approach: sum cashPnl + realizedPnl from open AND closed positions.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  let portfolioValue = 0, cashPnl = 0, realizedPnl = 0;
  let positionCount = 0, closedCount = 0;

  // 1. Open positions → unrealised PnL + portfolio value
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${addr}&sizeThreshold=0.01&limit=500`, { headers }
    );
    if (res.ok) {
      const arr = await res.json();
      const items = Array.isArray(arr) ? arr : [];
      items.forEach(p => {
        portfolioValue += Number(p.currentValue ?? 0);
        cashPnl        += Number(p.cashPnl      ?? 0);
        realizedPnl    += Number(p.realizedPnl   ?? 0); // some open positions have partial realised
      });
      positionCount = items.length;
    }
  } catch (_) {}

  // 2. Closed positions → realised PnL from resolved markets
  // Use timestamp cursor pagination (no offset support)
  let lastTs = 0;
  let closedPage = 0;
  try {
    while (closedPage < 20) {
      let url = `https://data-api.polymarket.com/closed-positions?user=${addr}&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
      if (lastTs > 0) url += `&start=${lastTs + 1}`;

      const res = await fetch(url, { headers });
      if (!res.ok) break;

      const items = await res.json();
      const arr = Array.isArray(items) ? items : [];
      if (arr.length === 0) break;

      arr.forEach(p => {
        realizedPnl += Number(p.realizedPnl ?? p.cashPnl ?? p.profit ?? 0);
      });
      closedCount += arr.length;

      const newTs = Number(arr[arr.length - 1]?.timestamp ?? 0);
      if (newTs <= lastTs) break;
      lastTs = newTs;

      if (arr.length < 500) break;
      closedPage++;
    }
  } catch (_) {}

  const totalPnl = cashPnl + realizedPnl;

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ portfolioValue, cashPnl, realizedPnl, totalPnl, positionCount, closedCount }),
  };
};
