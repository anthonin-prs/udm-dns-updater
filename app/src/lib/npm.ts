// Nginx Proxy Manager API client — server-side only

export interface NpmProxyHost {
  id: number;
  domain_names: string[];
  forward_host: string;
  forward_port: number;
  forward_scheme: string;
  access_list_id: number;
  enabled: boolean;
  meta: { nginx_online?: boolean; nginx_err?: string | null };
}

export interface NpmAccessList {
  id: number;
  name: string;
}

function baseUrl(): string {
  const ip = process.env.NPM_IP;
  if (!ip) throw new Error("NPM_IP is not set");
  return `http://${ip}:81`;
}

let cachedToken: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  // Reuse token if still valid (with 60s margin)
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const identity = process.env.NPM_USERNAME;
  const secret = process.env.NPM_PASSWORD;
  if (!identity || !secret) {
    throw new Error("NPM_USERNAME and NPM_PASSWORD must be set");
  }

  const res = await fetch(`${baseUrl()}/api/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, secret }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPM auth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  cachedToken = {
    token: data.token,
    expires: new Date(data.expires).getTime(),
  };
  return cachedToken.token;
}

async function npmFetch<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPM ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listAccessLists(): Promise<NpmAccessList[]> {
  return npmFetch<NpmAccessList[]>("/nginx/access-lists");
}

export async function listProxyHosts(): Promise<NpmProxyHost[]> {
  return npmFetch<NpmProxyHost[]>("/nginx/proxy-hosts");
}

/**
 * Returns proxy hosts whose access list name matches the target.
 * Fetches access lists once to resolve the ID, then filters proxy hosts.
 */
export async function getProxyHostsByAccessList(
  accessListName: string
): Promise<NpmProxyHost[]> {
  const [accessLists, proxyHosts] = await Promise.all([
    listAccessLists(),
    listProxyHosts(),
  ]);

  const targetList = accessLists.find((al) => al.name === accessListName);
  if (!targetList) {
    throw new Error(
      `Access list "${accessListName}" not found. Available: ${accessLists.map((a) => a.name).join(", ")}`
    );
  }

  return proxyHosts.filter(
    (h) => h.enabled && h.access_list_id === targetList.id
  );
}
