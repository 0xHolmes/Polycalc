// Proxies: GET https://data-api.polymarket.com/value?user={address}
// Returns portfolio value (used as PnL proxy)

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) {
    return { statusCode: 400, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    const url = `https://data-api.polymarket.com/value?user=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `Upstream ${res.status}` }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
