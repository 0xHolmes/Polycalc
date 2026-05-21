// Proxies: GET https://data-api.polymarket.com/activity?user={address}&type=REWARD&limit=500
// Used to sum total LP rewards earned (usdcSize of REWARD type activities)

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) {
    return { statusCode: 400, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    const url = `https://data-api.polymarket.com/activity?user=${encodeURIComponent(address)}&type=REWARD&limit=500&sortBy=TIMESTAMP&sortDirection=ASC`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `Upstream ${res.status}` }) };
    }

    const data = await res.json();

    // Pre-compute summary server-side to reduce payload
    const items = Array.isArray(data) ? data : [];
    const totalLP = items.reduce((sum, a) => sum + (Number(a.usdcSize) || 0), 0);
    const earliest = items.length
      ? Math.min(...items.map((a) => a.timestamp || Infinity))
      : null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        totalLPRewards: totalLP,
        rewardCount: items.length,
        earliestTimestamp: earliest === Infinity ? null : earliest,
        items: items.slice(0, 20), // return first 20 for display
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
