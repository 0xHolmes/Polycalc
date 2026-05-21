// leaderboard.js — Tries multiple Polymarket leaderboard endpoint formats
// The API path and param names vary; we try in order until one works.

const CANDIDATE_URLS = [
  (l,w,o) => `https://data-api.polymarket.com/leaderboard?limit=${l}&window=${w}&orderBy=${o}`,
  (l,w,o) => `https://data-api.polymarket.com/leaderboard?limit=${l}&window=${w}&sortBy=${o}`,
  (l,w,o) => `https://data-api.polymarket.com/leaderboard?limit=${l}&timeframe=${w}&orderBy=${o}`,
  (l,w,o) => `https://data-api.polymarket.com/leaderboard?limit=${l}`,
  (l,w,o) => `https://data-api.polymarket.com/leaderboard`,
];

function normalise(rows, offset) {
  return rows.map((r, i) => ({
    rank:         r.rank           ?? i + 1 + offset,
    proxyWallet:  r.proxyWallet    ?? r.address ?? r.wallet ?? "",
    name:         r.name           ?? r.pseudonym ?? null,
    pseudonym:    r.pseudonym      ?? r.name      ?? null,
    volume:       Number(r.volumeTraded ?? r.volume ?? r.totalVolume ?? 0),
    profit:       Number(r.profit       ?? r.pnl    ?? r.totalProfit ?? r.cashPnl ?? 0),
    numTrades:    Number(r.numTrades    ?? r.tradeCount ?? 0),
  }));
}

exports.handler = async (event) => {
  const qs     = event.queryStringParameters ?? {};
  const limit  = Math.min(Number(qs.limit ?? 50), 100);
  const offset = Number(qs.offset ?? 0);
  const window = ["1d","7d","30d","all"].includes(qs.window) ? qs.window : "all";
  const order  = ["profit","volume"].includes(qs.orderBy) ? qs.orderBy : "profit";

  for (const buildUrl of CANDIDATE_URLS) {
    try {
      const url = buildUrl(limit, window, order);
      const res = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"PolyCalc/1.0" } });

      if (!res.ok) continue; // try next candidate

      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.data ?? data?.leaderboard ?? data?.rows ?? []);

      if (!rows.length) continue; // empty — try next

      return {
        statusCode: 200,
        headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
        body: JSON.stringify({ rows: normalise(rows, offset), window, orderBy: order, source: url }),
      };
    } catch (_) { /* try next */ }
  }

  // All candidates failed — return helpful error
  return {
    statusCode: 503,
    headers: { "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ error:"Polymarket leaderboard API unavailable — try again shortly", rows:[] }),
  };
};
