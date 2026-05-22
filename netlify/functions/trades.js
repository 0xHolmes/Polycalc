// trades.js — Recent trades via /activity?type=TRADE (reliable)
// The /trades endpoint returns 502 for many wallets.
// /activity with type=TRADE is documented and working.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) return { statusCode:400, body:JSON.stringify({error:"address required"}) };

  try {
    // Use activity endpoint sorted DESC (most recent first) with type=TRADE
    const url = `https://data-api.polymarket.com/activity?user=${encodeURIComponent(address)}&type=TRADE&limit=20&sortBy=TIMESTAMP&sortDirection=DESC`;
    const res = await fetch(url, {
      headers: { Accept:"application/json", "User-Agent":"PolyCalc/1.0" },
    });

    if (!res.ok) return { statusCode:res.status, body:JSON.stringify({error:`Upstream ${res.status}`}) };

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify(Array.isArray(data) ? data : []),
    };
  } catch (err) {
    return { statusCode:500, headers:{"Access-Control-Allow-Origin":"*"}, body:JSON.stringify({error:err.message}) };
  }
};
