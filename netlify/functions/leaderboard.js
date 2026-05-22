// leaderboard.js — Correct Polymarket leaderboard endpoint
// Official docs response: { rank, proxyWallet, userName, vol, pnl, profileImage, xUsername }
// CLI: `polymarket data leaderboard --period month --order-by pnl --limit 10`
// Params: period (day|week|month|all), orderBy (pnl|vol), limit

// Try every known URL pattern until one works
async function tryFetch(limit, period, orderBy) {
  const headers = { Accept:"application/json", "User-Agent":"PolyCalc/1.0" };

  const urls = [
    // Official format from CLI: period + orderBy
    `https://data-api.polymarket.com/leaderboard?limit=${limit}&period=${period}&orderBy=${orderBy}`,
    // Variations seen in the wild
    `https://data-api.polymarket.com/leaderboard?limit=${limit}&period=${period}&order_by=${orderBy}`,
    `https://data-api.polymarket.com/leaderboard?limit=${limit}&window=${period}&orderBy=${orderBy}`,
    // No period filter (just get whatever the default is)
    `https://data-api.polymarket.com/leaderboard?limit=${limit}&orderBy=${orderBy}`,
    `https://data-api.polymarket.com/leaderboard?limit=${limit}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.data ?? data?.leaderboard ?? data?.rows ?? []);
      if (rows.length > 0) return { rows, source: url };
    } catch(_) {}
  }
  return null;
}

exports.handler = async (event) => {
  const qs      = event.queryStringParameters ?? {};
  const limit   = Math.min(Number(qs.limit ?? 50), 100);
  // Map our UI values to Polymarket CLI period values
  const periodMap = { "1d":"day", "7d":"week", "30d":"month", "all":"all" };
  const period  = periodMap[qs.window] ?? qs.period ?? "all";
  const orderBy = qs.orderBy === "volume" ? "vol" : "pnl";

  const result = await tryFetch(limit, period, orderBy);

  if (!result) {
    return {
      statusCode: 503,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ error:"All leaderboard endpoints returned empty or errored. API may be temporarily unavailable.", rows:[] }),
    };
  }

  // Normalise to consistent field names
  // Official fields: rank, proxyWallet, userName, vol, pnl, profileImage, xUsername
  const normalised = result.rows.map((r, i) => ({
    rank:         Number(r.rank ?? i + 1),
    proxyWallet:  r.proxyWallet  ?? r.address   ?? r.wallet   ?? "",
    name:         r.userName     ?? r.name      ?? r.pseudonym ?? null,
    profileImage: r.profileImage ?? null,
    xUsername:    r.xUsername    ?? null,
    volume:       Number(r.vol  ?? r.volume     ?? r.volumeTraded ?? 0),
    pnl:          Number(r.pnl  ?? r.profit     ?? r.cashPnl     ?? 0),
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ rows: normalised, source: result.source }),
  };
};
