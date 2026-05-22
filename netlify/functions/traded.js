// traded.js — Use the DIRECT /traded endpoint (what Polymarket CLI uses)
// `polymarket data traded 0xWALLET` → GET /traded?user=ADDRESS
// This returns the official total volume, no summing needed.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };
  let result = {};

  // Try the direct /traded endpoint first (official, used by Polymarket CLI)
  try {
    const res = await fetch(`https://data-api.polymarket.com/traded?user=${addr}`, { headers });
    if (res.ok) {
      const raw = await res.json();
      // Response can be a number, an object, or have various field names
      const vol = typeof raw === "number" ? raw
        : Number(raw?.volumeTraded ?? raw?.volume ?? raw?.totalVolume ?? raw?.traded ?? raw ?? 0);
      if (vol > 0) {
        result.volumeTraded = vol;
        result.source = "traded";
      }
    }
  } catch(_) {}

  // If /traded returned 0 or failed, try /profit endpoint which also has volume
  if (!result.volumeTraded) {
    try {
      const res = await fetch(`https://data-api.polymarket.com/profit?user=${addr}`, { headers });
      if (res.ok) {
        const raw = await res.json();
        const vol = Number(raw?.volume ?? raw?.volumeTraded ?? 0);
        if (vol > 0) {
          result.volumeTraded = vol;
          result.source = "profit";
        }
        // Also grab PnL while we're here
        result.profitFromEndpoint = Number(raw?.profit ?? raw?.pnl ?? 0);
      }
    } catch(_) {}
  }

  // Fallback: sum from activity (paginated, up to 3000 trades)
  if (!result.volumeTraded) {
    try {
      let all = [];
      for (let page = 0; page < 6; page++) {
        const url = `https://data-api.polymarket.com/activity?user=${addr}&type=TRADE&limit=500&offset=${page*500}&sortBy=TIMESTAMP&sortDirection=ASC`;
        const res = await fetch(url, { headers });
        if (!res.ok) break;
        const batch = await res.json();
        const items = Array.isArray(batch) ? batch : [];
        all = all.concat(items);
        if (items.length < 500) break;
      }
      result.volumeTraded = all.reduce((s,t) => {
        const u = Number(t.usdcSize); const c = Number(t.size)*Number(t.price);
        return s + (u > 0 ? u : c > 0 ? c : 0);
      }, 0);
      result.tradeCount = all.length;
      result.source = "activity";
      const ts = all.map(t=>t.timestamp).filter(Boolean);
      result.earliestTradeTimestamp = ts.length ? Math.min(...ts) : null;
    } catch(_) {}
  }

  // Also get earliest trade timestamp if we don't have it yet
  if (!result.earliestTradeTimestamp) {
    try {
      const res = await fetch(`https://data-api.polymarket.com/activity?user=${addr}&type=TRADE&limit=1&sortBy=TIMESTAMP&sortDirection=ASC`, { headers });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        if (items.length) result.earliestTradeTimestamp = items[0].timestamp ?? null;
      }
    } catch(_) {}
  }

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify(result),
  };
};
