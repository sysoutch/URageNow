function createDashboardDesktopToolApiHelpers(input) {
  const fetchRequest = typeof input?.fetchRequest === "function"
    ? input.fetchRequest
    : (...args) => fetch(...args);

  async function request(url, options) {
    const response = await fetchRequest(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || "Request failed.");
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function post(url, body) {
    return request(url, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(body || {})
    });
  }

  return {
    get: url => request(url),
    post
  };
}
