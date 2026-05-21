// profile.js — Fixed version
// gamma-api.polymarket.com/profiles returns 401 for public requests.
// Instead, we pull profile info from the first activity item —
// the data-api activity response already includes: name, pseudonym, bio, profileImage.

exports.handler = async (event) => {
  const address = event.queryStringParameters?.address;
  if (!address) {
    return { statusCode: 400, body: JSON.stringify({ error: "address required" }) };
  }

  try {
    // Activity endpoint is public and each item contains profile fields
    const url = `https://data-api.polymarket.com/activity?user=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PolyCalc/1.0" },
    });

    if (!res.ok) throw new Error(`Activity HTTP ${res.status}`);

    const data = await res.json();
    const item = Array.isArray(data) && data.length > 0 ? data[0] : null;

    const profile = {
      proxyWallet:          item?.proxyWallet          ?? address,
      name:                 item?.name                 ?? null,
      pseudonym:            item?.pseudonym             ?? null,
      bio:                  item?.bio                  ?? null,
      profileImage:         item?.profileImage         ?? null,
      profileImageOptimized:item?.profileImageOptimized ?? null,
      twitterUsername:      null, // Requires authenticated gamma-api; not available publicly
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(profile),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
