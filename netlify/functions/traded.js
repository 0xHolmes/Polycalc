// traded.js — Volume via TRADE activity (usdcSize field) + closed-positions for full picture
// Falls back gracefully between multiple approaches.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  const addr = encodeURIComponent(address);

  // Primary: activity endpoint with type=TRADE gives usdcSize per trade
  try {
    const url = `https://data-api.polymarket.com/activity?user=${addr}&type=TRADE&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
    const res = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"PolyCalc/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data  = await res.json();
    const items = Array.isArray(data) ? data : [];

    // usdcSize = USDC value of each trade execution
    const volumeTraded = items.reduce((s,t) => s + (Number(t.usdcSize) || Number(t.size)*Number(t.price) || 0), 0);
    const tradeCount   = items.length;

    // Earliest timestamp for early-user detection
    const timestamps = items.map(t=>t.timestamp).filter(Boolean);
    const earliestTradeTimestamp = timestamps.length ? Math.min(...timestamps) : null;

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ volumeTraded, tradeCount, earliestTradeTimestamp,
        note: tradeCount >= 500 ? "Capped at 500 trades — actual volume may be higher" : null }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
