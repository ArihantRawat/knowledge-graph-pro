export async function slackApi(method, token, params = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}

export async function exchangeSlackCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

export async function fetchSlackProfile(token) {
  const auth = await slackApi("auth.test", token);
  if (!auth.ok) {
    return null;
  }
  return {
    id: auth.user_id,
    name: auth.user,
    team: auth.team
  };
}
