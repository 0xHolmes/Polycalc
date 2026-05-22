// leaderboard.js — CORRECT URL from official Polymarket docs:
// curl --url https://data-api.polymarket.com/v1/leaderboard
// Params: timePeriod (DAY|WEEK|MONTH|ALL), orderBy (PNL|VOL), category (OVERALL)
// Response: [{ rank, proxyWallet, userName, vol, pnl, profileImage, xUsername, verifiedBadge }]

exports.handler = async (event) => {
  const qs = event.queryStringParameters ?? {};
  const limit = Math.min(Number(qs.limit ?? 50), 100);

  // Map UI values to official API enum values (UPPERCASE)
  const periodMap = { "1d":"DAY", "7d":"WEEK", "30d":"MONTH", "all":"ALL" };
  const timePeriod = periodMap[qs.window] ?? "ALL";
  const orderBy = qs.orderBy === "volume" ? "VOL" : "PNL";

  const url = `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${timePeriod}&orderBy=${orderBy}&category=OVERALL&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
        body: JSON.stringify({ error: `Polymarket API returned ${res.status}`, url, rows: [] }),
      };
    }

    const data = await res.json();
    const rows = (Array.isArray(data) ? data : data?.data ?? []).map((r, i) => ({
      rank:         Number(r.rank ?? i + 1),
      proxyWallet:  r.proxyWallet ?? "",
      name:         r.userName    ?? null,
      profileImage: r.profileImage ?? null,
      xUsername:    r.xUsername    ?? null,
      volume:       Number(r.vol  ?? 0),
      pnl:          Number(r.pnl  ?? 0),
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ rows, source: url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ error: err.message, rows: [] }),
    };
  }
};
