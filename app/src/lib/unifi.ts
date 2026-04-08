function getEnv(key: string, required = false): string {
  const val = process.env[key] || "";
  if (required && !val) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return val;
}

function headers() {
  return {
    "X-API-KEY": getEnv("UDM_API_KEY", true),
    "Content-Type": "application/json",
  };
}

function baseUrl() {
  return getEnv("UDM_API_URL", true).replace(/\/+$/, "");
}

export async function getSiteId(): Promise<string> {
  const envSiteId = process.env.UDM_API_SITE_ID || "";
  if (envSiteId) return envSiteId;

  const res = await fetch(
    `${baseUrl()}/proxy/network/integration/v1/sites`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch sites: ${res.status}`);
  const json = await res.json();
  const id = json?.data?.[0]?.id;
  if (!id) throw new Error("No site found");
  return id;
}

export async function listDnsPolicies() {
  const siteId = await getSiteId();
  const res = await fetch(
    `${baseUrl()}/proxy/network/integration/v1/sites/${siteId}/dns/policies`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to list DNS policies: ${res.status}`);
  return res.json();
}

export async function getDnsPolicy(policyId: string) {
  const siteId = await getSiteId();
  const res = await fetch(
    `${baseUrl()}/proxy/network/integration/v1/sites/${siteId}/dns/policies/${encodeURIComponent(policyId)}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to get DNS policy: ${res.status}`);
  return res.json();
}

export async function createDnsPolicy(body: Record<string, unknown>) {
  const siteId = await getSiteId();
  const res = await fetch(
    `${baseUrl()}/proxy/network/integration/v1/sites/${siteId}/dns/policies`,
    { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create DNS policy: ${res.status} ${text}`);
  }
  return res.json();
}

export async function updateDnsPolicy(policyId: string, body: Record<string, unknown>) {
  const siteId = await getSiteId();
  const res = await fetch(
    `${baseUrl()}/proxy/network/integration/v1/sites/${siteId}/dns/policies/${encodeURIComponent(policyId)}`,
    { method: "PUT", headers: headers(), body: JSON.stringify(body), cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update DNS policy: ${res.status} ${text}`);
  }
  return res.json();
}

export async function deleteDnsPolicy(policyId: string) {
  const siteId = await getSiteId();
  const res = await fetch(
    `${baseUrl()}/proxy/network/integration/v1/sites/${siteId}/dns/policies/${encodeURIComponent(policyId)}`,
    { method: "DELETE", headers: headers(), cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete DNS policy: ${res.status} ${text}`);
  }
  // DELETE may return empty body
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}
