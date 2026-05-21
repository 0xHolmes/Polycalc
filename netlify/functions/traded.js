// traded.js — Paginated volume fetch (up to 4 pages × 500 = 2000 TRADE events)
// Fixes: single page capped at 500 showing $7K instead of real $39K+

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);
  let allItems = [];
  let page = 0;
  const PAGE_SIZE = 500;
  const MAX_PAGES = 6; // up to 3,000 trades before giving up

  try {
    // Paginate using offset until we get a partial page or hit MAX_PAGES
    while (page < MAX_PAGES) {
      const offset = page * PAGE_SIZE;
      const url = `https://data-api.polymarket.com/activity?user=${addr}&type=TRADE&limit=${PAGE_SIZE}&offset=${offset}&sortBy=TIMESTAMP&sortDirection=ASC`;
      const res = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"PolyCalc/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const batch = await res.json();
      const items = Array.isArray(batch) ? batch : [];
      allItems = allItems.concat(items);

      // Stop if this page was not full (means we got all trades)
      if (items.length < PAGE_SIZE) break;
      page++;
    }

    // Sum usdcSize; fall back to size×price if usdcSize missing
    const volumeTraded = allItems.reduce((s, t) => {
      const usdc = Number(t.usdcSize);
      const calc = Number(t.size) * Number(t.price);
      return s + (usdc > 0 ? usdc : calc > 0 ? calc : 0);
    }, 0);

    const tradeCount = allItems.length;
    const timestamps = allItems.map(t => t.timestamp).filter(Boolean);
    const earliestTradeTimestamp = timestamps.length ? Math.min(...timestamps) : null;
    const capped = page >= MAX_PAGES;

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({
        volumeTraded,
        tradeCount,
        earliestTradeTimestamp,
        pagesLoaded: page + 1,
        capped,
        note: capped ? `Capped at ${tradeCount} trades — actual volume may be higher` : null,
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
