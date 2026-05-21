// traded.js — Fixed version
// The /traded endpoint returns { volumeTraded: 0 } for many wallets because
// it tracks proxy-wallet volume, not deposit-address volume.
// Instead: fetch all TRADE-type activity and sum usdcSize — this works for any address.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) {
    return { statusCode: 400, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    // Fetch up to 500 trade activity items (covers most wallets fully)
    const url = `https://data-api.polymarket.com/activity?user=${encodeURIComponent(address)}&type=TRADE&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!res.ok) throw new Error(`Activity HTTP ${res.status}`);

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];

    // Sum usdcSize across all trades — this is the USDC amount of each trade
    const volumeTraded = items.reduce((sum, t) => sum + (Number(t.usdcSize) || 0), 0);

    // Also detect earliest trade date (for early-user eligibility)
    const timestamps = items.map((t) => t.timestamp).filter(Boolean);
    const earliestTradeTimestamp = timestamps.length ? Math.min(...timestamps) : null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        volumeTraded,
        tradeCount: items.length,
        earliestTradeTimestamp,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
