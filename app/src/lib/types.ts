export interface DnsRecord {
  _id?: string;
  id?: string;
  key?: string;
  enabled: boolean;
  domain: string;
  type: string;
  ipv4Address?: string;
  ipv6Address?: string;
  value?: string;
  ttlSeconds?: number;
  priority?: number;
  weight?: number;
  port?: number;
  origin?: string;
  [key: string]: unknown;
}

export const DNS_TYPES = [
  "A_RECORD",
  "AAAA_RECORD",
  "CNAME_RECORD",
  "MX_RECORD",
  "TXT_RECORD",
  "SRV_RECORD",
  "FORWARD_DOMAIN",
] as const;

export type DnsType = (typeof DNS_TYPES)[number];
