// traded.js — Volume via timestamp-cursor pagination on /activity
// The /traded endpoint returns incorrect values for many wallets.
// The /activity endpoint doesn't support offset — use start/end timestamps.
// Confirmed params from Polymarket Notion docs:
//   user, type, start, end, sortBy, sortDirection, limit (no offset!)

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  let allItems = [];
  let lastTimestamp = 0; // cursor: fetch trades after this timestamp
  let pageCount = 0;
  const MAX_PAGES = 20; // up to 10,000 trades

  try {
    while (pageCount < MAX_PAGES) {
      // Use start= for cursor pagination (trades after lastTimestamp)
      let url = `https://data-api.polymarket.com/activity?user=${addr}&type=TRADE&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
      if (lastTimestamp > 0) url += `&start=${lastTimestamp + 1}`;

      const res = await fetch(url, { headers });
      if (!res.ok) break;

      const batch = await res.json();
      const items = Array.isArray(batch) ? batch : [];
      if (items.length === 0) break;

      allItems = allItems.concat(items);

      // Update cursor to last item's timestamp
      const lastItem = items[items.length - 1];
      const newTs = Number(lastItem.timestamp ?? 0);
      if (newTs <= lastTimestamp) break; // stuck, prevent infinite loop
      lastTimestamp = newTs;

      if (items.length < 500) break; // partial page = done
      pageCount++;
    }

    // Sum volume: usdcSize is the USDC amount per trade
    const volumeTraded = allItems.reduce((s, t) => {
      const usdc = Number(t.usdcSize);
      if (usdc > 0) return s + usdc;
      const calc = Number(t.size) * Number(t.price);
      return s + (calc > 0 ? calc : 0);
    }, 0);

    const tradeCount = allItems.length;
    const timestamps = allItems.map(t => t.timestamp).filter(Boolean);
    const earliestTradeTimestamp = timestamps.length ? Math.min(...timestamps) : null;

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({
        volumeTraded,
        tradeCount,
        earliestTradeTimestamp,
        pagesLoaded: pageCount + 1,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
