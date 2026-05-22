// traded.js — Volume = sum of SIZE (shares), not usdcSize
// Polymarket leaderboard counts volume as total shares traded (each = $1 at resolution)
// Pagination: timestamp cursor (no offset support)

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  let allItems = [];
  let lastTimestamp = 0;
  let pageCount = 0;

  try {
    while (pageCount < 30) {
      let url = `https://data-api.polymarket.com/activity?user=${addr}&type=TRADE&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
      if (lastTimestamp > 0) url += `&start=${lastTimestamp}`;

      const res = await fetch(url, { headers });
      if (!res.ok) break;

      const batch = await res.json();
      const items = Array.isArray(batch) ? batch : [];
      if (items.length === 0) break;

      // Deduplicate: if first item timestamp = lastTimestamp, skip items we already have
      const newItems = lastTimestamp > 0
        ? items.filter(t => {
            const ts = Number(t.timestamp ?? 0);
            return ts > lastTimestamp || (ts === lastTimestamp && !allItems.some(e =>
              e.timestamp === t.timestamp && e.asset === t.asset && e.size === t.size
            ));
          })
        : items;

      if (newItems.length === 0) break;
      allItems = allItems.concat(newItems);

      const lastItem = items[items.length - 1];
      const newTs = Number(lastItem.timestamp ?? 0);
      if (newTs <= lastTimestamp && items.length < 500) break;
      lastTimestamp = newTs;

      if (items.length < 500) break;
      pageCount++;
    }

    // Volume = sum of SIZE (shares traded), which is what Polymarket leaderboard shows
    // This is the notional value: each share = $1 at resolution
    const volumeBySize = allItems.reduce((s, t) => s + (Number(t.size) || 0), 0);
    // Also compute usdcSize sum for reference
    const volumeByUsdc = allItems.reduce((s, t) => {
      const u = Number(t.usdcSize);
      return s + (u > 0 ? u : (Number(t.size) || 0) * (Number(t.price) || 0));
    }, 0);

    const tradeCount = allItems.length;
    const timestamps = allItems.map(t => t.timestamp).filter(Boolean);
    const earliestTradeTimestamp = timestamps.length ? Math.min(...timestamps) : null;

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({
        volumeTraded: volumeBySize,   // shares (what LB shows)
        volumeUsdc: volumeByUsdc,     // USDC spent
        tradeCount,
        earliestTradeTimestamp,
        pagesLoaded: pageCount + 1,
      }),
    };
  } catch (err) {
    return { statusCode:500, headers:{"Access-Control-Allow-Origin":"*"}, body:JSON.stringify({error:err.message}) };
  }
};
