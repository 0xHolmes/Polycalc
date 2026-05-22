// value.js — PnL: open positions cashPnl+realizedPnl + ALL closed positions
// Don't paginate closed-positions with timestamp (field may not exist)
// Instead: fetch multiple pages using simple incrementing offset-style via limit+skip

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  let portfolioValue = 0, cashPnl = 0, realizedPnl = 0;
  let positionCount = 0, closedCount = 0;

  // 1. ALL open positions (even tiny ones)
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${addr}&sizeThreshold=0&limit=1000`, { headers }
    );
    if (res.ok) {
      const arr = await res.json();
      const items = Array.isArray(arr) ? arr : [];
      items.forEach(p => {
        portfolioValue += Number(p.currentValue ?? 0);
        cashPnl        += Number(p.cashPnl      ?? 0);
        realizedPnl    += Number(p.realizedPnl   ?? 0);
      });
      positionCount = items.length;
    }
  } catch (_) {}

  // 2. ALL closed positions — try fetching with large limit, then paginate by timestamp
  try {
    let lastTs = 0;
    let page = 0;
    while (page < 30) {
      // Try multiple pagination approaches
      let url = `https://data-api.polymarket.com/closed-positions?user=${addr}&limit=500`;

      // Add sort params
      url += `&sortBy=TIMESTAMP&sortDirection=ASC`;

      // Timestamp cursor if not first page
      if (lastTs > 0) url += `&start=${lastTs}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        // If sortBy/start not supported, try without
        if (page === 0) {
          const fallbackUrl = `https://data-api.polymarket.com/closed-positions?user=${addr}&limit=1000`;
          const fallbackRes = await fetch(fallbackUrl, { headers });
          if (fallbackRes.ok) {
            const items = await fallbackRes.json();
            const arr = Array.isArray(items) ? items : [];
            arr.forEach(p => {
              realizedPnl += Number(p.realizedPnl ?? p.cashPnl ?? 0);
            });
            closedCount = arr.length;
          }
        }
        break;
      }

      const items = await res.json();
      const arr = Array.isArray(items) ? items : [];
      if (arr.length === 0) break;

      arr.forEach(p => {
        realizedPnl += Number(p.realizedPnl ?? p.cashPnl ?? 0);
      });
      closedCount += arr.length;

      // Get timestamp of last item for cursor
      const newTs = Number(arr[arr.length - 1]?.timestamp ??
                          arr[arr.length - 1]?.endDate ??
                          arr[arr.length - 1]?.resolvedAt ?? 0);
      if (newTs <= lastTs) break;
      lastTs = newTs;

      if (arr.length < 500) break;
      page++;
    }
  } catch (_) {}

  const totalPnl = cashPnl + realizedPnl;

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ portfolioValue, cashPnl, realizedPnl, totalPnl, positionCount, closedCount }),
  };
};
