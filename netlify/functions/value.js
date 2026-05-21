// value.js — Fixed with CORRECT field names from Polymarket positions API
// Confirmed real response shape from docs:
// { size, avgPrice, initialValue, currentValue, cashPnl, percentPnl,
//   realizedPnl, curPrice, redeemable, title, outcome, ... }

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  try {
    const url = `https://data-api.polymarket.com/positions?user=${encodeURIComponent(address)}&sizeThreshold=0.01&limit=500`;
    const res = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"PolyCalc/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data  = await res.json();
    const items = Array.isArray(data) ? data : [];

    let portfolioValue = 0; // sum of currentValue (what holdings are worth now)
    let initialValue   = 0; // sum of initialValue (what was paid)
    let cashPnl        = 0; // sum of cashPnl (unrealised)
    let realizedPnl    = 0; // sum of realizedPnl (realised from closed portions)

    items.forEach(p => {
      portfolioValue += Number(p.currentValue  ?? 0);
      initialValue   += Number(p.initialValue  ?? 0);
      cashPnl        += Number(p.cashPnl       ?? 0);
      realizedPnl    += Number(p.realizedPnl   ?? 0);
    });

    const totalPnl       = cashPnl + realizedPnl;
    const positionCount  = items.length;

    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({
        portfolioValue,   // current market value of open positions
        initialValue,     // total USDC spent on open positions
        cashPnl,          // unrealised PnL
        realizedPnl,      // realised PnL
        totalPnl,         // cashPnl + realizedPnl
        positionCount,
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
