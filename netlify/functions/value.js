// value.js — Fixed version
// /value endpoint returns 0 for many addresses.
// Instead: fetch open positions and sum their current value to get portfolio value,
// then compare against cost basis (initial value) to derive PnL.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) {
    return { statusCode: 400, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    // Fetch current open positions
    const posUrl = `https://data-api.polymarket.com/positions?user=${encodeURIComponent(address)}&sizeThreshold=0.01&limit=500`;
    const posRes = await fetch(posUrl, {
      headers: { Accept: "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!posRes.ok) throw new Error(`Positions HTTP ${posRes.status}`);

    const positions = await posRes.json();
    const items = Array.isArray(positions) ? positions : [];

    // currentValue  = size × current price (what it's worth now)
    // initialValue  = size × average entry price (what you paid)
    // cashPnl       = currentValue - initialValue
    let currentValue = 0;
    let initialValue = 0;

    items.forEach((p) => {
      const size  = Number(p.size           ?? p.shares         ?? 0);
      const price = Number(p.currentPrice   ?? p.price          ?? 0);
      const cost  = Number(p.averagePrice   ?? p.entryPrice     ?? p.initialPrice ?? price);

      currentValue += size * price;
      initialValue += size * cost;
    });

    const cashPnl        = currentValue - initialValue;
    const positionCount  = items.length;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        portfolioValue: currentValue,
        initialValue,
        cashPnl,
        positionCount,
      }),
    };
  } catch (err) {
    // Fallback: try the original /value endpoint
    try {
      const valUrl = `https://data-api.polymarket.com/value?user=${encodeURIComponent(address)}`;
      const valRes = await fetch(valUrl, {
        headers: { Accept: "application/json", "User-Agent": "PolyCalc/1.0" },
      });
      if (!valRes.ok) throw new Error(`Value HTTP ${valRes.status}`);
      const raw = await valRes.json();

      // Try every possible field name the API might use
      const val = Number(
        raw?.portfolioValue  ??
        raw?.value           ??
        raw?.totalValue      ??
        raw?.total           ??
        (Array.isArray(raw) ? raw[0]?.value : undefined) ??
        0
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ portfolioValue: val, cashPnl: val, positionCount: 0 }),
      };
    } catch (fallbackErr) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: err.message + " | fallback: " + fallbackErr.message }),
      };
    }
  }
};
