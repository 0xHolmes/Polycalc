// value.js — Use the official /profit endpoint for PnL (matches leaderboard)
// Plus /positions for current portfolio value
// `polymarket data value 0xWALLET` → /value?user=ADDRESS
// Also: /profit?user=ADDRESS for official P&L number

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };
  const result = { portfolioValue:0, totalPnl:0, cashPnl:0, realizedPnl:0, positionCount:0 };

  // 1. Official /profit endpoint — this is what Polymarket leaderboard uses
  try {
    const res = await fetch(`https://data-api.polymarket.com/profit?user=${addr}`, { headers });
    if (res.ok) {
      const raw = await res.json();
      result.totalPnl = Number(raw?.profit ?? raw?.pnl ?? raw?.totalPnl ?? 0);
      result.source = "profit";
      // Some responses include volume here too
      if (raw?.volume) result.volumeFromProfit = Number(raw.volume);
    }
  } catch(_) {}

  // 2. /value endpoint for portfolio value
  try {
    const res = await fetch(`https://data-api.polymarket.com/value?user=${addr}`, { headers });
    if (res.ok) {
      const raw = await res.json();
      result.portfolioValue = Number(
        raw?.portfolioValue ?? raw?.value ?? raw?.totalValue ??
        (typeof raw === "number" ? raw : 0)
      );
    }
  } catch(_) {}

  // 3. /positions for detailed breakdown + position count
  try {
    const res = await fetch(`https://data-api.polymarket.com/positions?user=${addr}&sizeThreshold=0.01&limit=500`, { headers });
    if (res.ok) {
      const items = await res.json();
      const arr = Array.isArray(items) ? items : [];
      result.positionCount = arr.length;

      // If /profit failed, compute PnL from positions
      if (!result.totalPnl && arr.length) {
        let cashPnl = 0, realizedPnl = 0, portVal = 0;
        arr.forEach(p => {
          cashPnl     += Number(p.cashPnl     ?? 0);
          realizedPnl += Number(p.realizedPnl ?? 0);
          portVal     += Number(p.currentValue ?? 0);
        });
        result.cashPnl     = cashPnl;
        result.realizedPnl = realizedPnl;
        result.totalPnl    = cashPnl + realizedPnl;
        if (!result.portfolioValue) result.portfolioValue = portVal;
        result.source = "positions";
      }
    }
  } catch(_) {}

  // 4. If still no PnL, try /closed-positions for realised PnL
  if (!result.totalPnl) {
    try {
      const res = await fetch(`https://data-api.polymarket.com/closed-positions?user=${addr}&limit=500`, { headers });
      if (res.ok) {
        const items = await res.json();
        const arr = Array.isArray(items) ? items : [];
        result.realizedPnl = arr.reduce((s,p) => s + Number(p.realizedPnl ?? p.cashPnl ?? p.profit ?? 0), 0);
        result.totalPnl = result.cashPnl + result.realizedPnl;
        result.source = "closed-positions";
      }
    } catch(_) {}
  }

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify(result),
  };
};
