import { DNS_TYPES } from "@/lib/types";

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$/;

export function validateValue(type: string, value: string): string | null {
  if (!value.trim()) return "Value is required";

  switch (type) {
    case "A_RECORD":
      if (!IPV4_RE.test(value)) return "Invalid IPv4 address (e.g. 192.168.1.10)";
      break;
    case "AAAA_RECORD":
      if (!IPV6_RE.test(value)) return "Invalid IPv6 address (e.g. 2001:db8::1)";
      break;
    case "CNAME_RECORD":
    case "FORWARD_DOMAIN":
      if (!DOMAIN_RE.test(value)) return "Invalid domain name (e.g. example.com)";
      break;
    case "MX_RECORD":
      if (!DOMAIN_RE.test(value)) return "Invalid mail server domain (e.g. mail.example.com)";
      break;
    // TXT and SRV accept freeform values
  }
  return null;
}

export function valuePlaceholder(type: string): string {
  switch (type) {
    case "A_RECORD": return "192.168.1.10";
    case "AAAA_RECORD": return "2001:db8::1";
    case "CNAME_RECORD": return "target.example.com";
    case "MX_RECORD": return "mail.example.com";
    case "TXT_RECORD": return "v=spf1 include:example.com ~all";
    case "SRV_RECORD": return "target.example.com";
    case "FORWARD_DOMAIN": return "forward.example.com";
    default: return "";
  }
}

export function valueLabel(type: string): string {
  switch (type) {
    case "A_RECORD": return "IPv4 Address";
    case "AAAA_RECORD": return "IPv6 Address";
    case "CNAME_RECORD":
    case "FORWARD_DOMAIN": return "Target Domain";
    case "MX_RECORD": return "Mail Server";
    case "TXT_RECORD": return "TXT Value";
    case "SRV_RECORD": return "SRV Value";
    default: return "IP / Value";
  }
}

/**
 * Validates and whitelists a raw DNS record body from an API request.
 * Returns either a sanitised body ready to forward to the UDM, or an error string.
 * Must be called server-side only (route handlers).
 */
export function buildAndValidateDnsBody(
  raw: unknown
): { body: Record<string, unknown> } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid request body" };
  }
  const input = raw as Record<string, unknown>;

  // Validate type
  const type = input.type;
  if (typeof type !== "string" || !(DNS_TYPES as readonly string[]).includes(type)) {
    return { error: `Invalid type. Must be one of: ${DNS_TYPES.join(", ")}` };
  }

  // Validate domain
  const domain = input.domain;
  if (typeof domain !== "string" || !DOMAIN_RE.test(domain)) {
    return { error: "Invalid domain name" };
  }

  // Determine and validate the value field
  const valueKey =
    type === "A_RECORD" ? "ipv4Address" :
    type === "AAAA_RECORD" ? "ipv6Address" : "value";
  const rawValue = input[valueKey];
  const value = typeof rawValue === "string" ? rawValue : "";
  const valErr = validateValue(type, value);
  if (valErr) return { error: valErr };

  // Validate TTL
  const rawTtl = input.ttlSeconds;
  const ttl =
    typeof rawTtl === "number" && Number.isFinite(rawTtl) && rawTtl > 0
      ? Math.floor(rawTtl)
      : 60;

  // Build whitelisted body
  const body: Record<string, unknown> = {
    type,
    domain,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    ttlSeconds: ttl,
  };

  if (type === "A_RECORD") body.ipv4Address = value;
  else if (type === "AAAA_RECORD") body.ipv6Address = value;
  else body.value = value;

  // SRV extras — numerics only
  if (type === "SRV_RECORD") {
    if (typeof input.priority === "number" && Number.isFinite(input.priority)) body.priority = Math.floor(input.priority);
    if (typeof input.weight === "number" && Number.isFinite(input.weight)) body.weight = Math.floor(input.weight);
    if (typeof input.port === "number" && Number.isFinite(input.port)) body.port = Math.floor(input.port);
  }

  return { body };
}
