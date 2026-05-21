// value.js — Fixed PnL: combines open positions (unrealised) + closed positions (realised)
// Fixes: showing -$8.95 instead of real -$264 because resolved markets were excluded

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  // ── 1. Open positions → current portfolio value + unrealised PnL
  let portfolioValue = 0;
  let initialValue   = 0;
  let cashPnl        = 0;        // unrealised PnL on open positions
  let positionCount  = 0;

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${addr}&sizeThreshold=0.01&limit=500`,
      { headers }
    );
    if (res.ok) {
      const items = await res.json();
      const arr = Array.isArray(items) ? items : [];
      arr.forEach(p => {
        portfolioValue += Number(p.currentValue ?? 0);
        initialValue   += Number(p.initialValue ?? 0);
        cashPnl        += Number(p.cashPnl      ?? 0);
      });
      positionCount = arr.length;
    }
  } catch (_) {}

  // ── 2. Closed/resolved positions → realised PnL (this is what the real LB counts)
  // Paginate because users can have hundreds of resolved markets
  let realizedPnl = 0;
  let closedCount = 0;
  let closedPage  = 0;
  const PAGE = 500;

  try {
    while (closedPage < 10) { // max 5,000 closed positions
      const res = await fetch(
        `https://data-api.polymarket.com/closed-positions?user=${addr}&limit=${PAGE}&offset=${closedPage * PAGE}`,
        { headers }
      );
      if (!res.ok) break;

      const batch = await res.json();
      const items = Array.isArray(batch) ? batch : [];

      items.forEach(p => {
        // closed-positions may use realizedPnl or cashPnl
        realizedPnl += Number(p.realizedPnl ?? p.cashPnl ?? p.profit ?? 0);
      });
      closedCount += items.length;

      if (items.length < PAGE) break;
      closedPage++;
    }
  } catch (_) {}

  const totalPnl = cashPnl + realizedPnl;

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({
      portfolioValue,   // current open position value
      initialValue,
      cashPnl,          // unrealised (open positions)
      realizedPnl,      // realised (closed/resolved positions)
      totalPnl,         // what Polymarket shows as P&L on leaderboard
      positionCount,
      closedCount,
    }),
  };
};
