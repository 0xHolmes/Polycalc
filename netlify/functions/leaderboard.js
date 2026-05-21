// leaderboard.js — Proxies the real Polymarket leaderboard
// GET https://data-api.polymarket.com/leaderboard
// Params: limit, offset, window (1d|7d|30d|all), orderBy (profit|volume)

exports.handler = async (event) => {
  const qs     = event.queryStringParameters ?? {};
  const limit  = Math.min(Number(qs.limit  ?? 50), 100);
  const offset = Number(qs.offset ?? 0);
  const window = ["1d", "7d", "30d", "all"].includes(qs.window) ? qs.window : "all";
  const order  = ["profit", "volume"].includes(qs.orderBy)      ? qs.orderBy : "profit";

  try {
    const url = `https://data-api.polymarket.com/leaderboard?limit=${limit}&offset=${offset}&window=${window}&orderBy=${order}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PolyCalc/1.0" },
    });
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data?.data ?? data?.leaderboard ?? []);

    // Normalise fields — API may use different key names
    const normalised = rows.map((r, i) => ({
      rank:         r.rank          ?? i + 1 + offset,
      proxyWallet:  r.proxyWallet   ?? r.address ?? r.wallet ?? "",
      name:         r.name          ?? r.pseudonym ?? null,
      pseudonym:    r.pseudonym     ?? r.name ?? null,
      profileImage: r.profileImage  ?? r.profileImageOptimized ?? null,
      volume:       Number(r.volumeTraded ?? r.volume    ?? r.totalVolume ?? 0),
      profit:       Number(r.profit       ?? r.pnl       ?? r.totalProfit ?? 0),
      numTrades:    Number(r.numTrades    ?? r.tradeCount ?? 0),
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ rows: normalised, window, orderBy: order, total: normalised.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message, rows: [] }),
    };
  }
};
