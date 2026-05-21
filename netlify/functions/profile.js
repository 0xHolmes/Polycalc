// Proxies: GET https://gamma-api.polymarket.com/profiles?id={address}
// Netlify runs this server-side so CORS is not an issue.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) {
    return { statusCode: 400, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    const url = `https://gamma-api.polymarket.com/profiles?id=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `Upstream error ${res.status}` }),
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
