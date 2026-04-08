"use client";

import { useState } from "react";
import { DNS_TYPES, DnsType } from "@/lib/types";
import { validateValue, valuePlaceholder, valueLabel } from "@/lib/validation";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRecordModal({ onClose, onCreated }: Props) {
  const [domain, setDomain] = useState("");
  const [type, setType] = useState<DnsType>("A_RECORD");
  const [ip, setIp] = useState("");
  const [ttl, setTtl] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleCreate() {
    const valErr = validateValue(type, ip);
    if (valErr) {
      setFieldError(valErr);
      return;
    }
    setFieldError(null);
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        type,
        enabled,
        domain,
        ttlSeconds: ttl,
      };
      if (type === "AAAA_RECORD") {
        body.ipv6Address = ip;
      } else if (type === "CNAME_RECORD" || type === "MX_RECORD" || type === "TXT_RECORD" || type === "SRV_RECORD" || type === "FORWARD_DOMAIN") {
        body.value = ip;
      } else {
        body.ipv4Address = ip;
      }

      const res = await fetch("/api/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full h-10 px-3 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-unifi-blue focus:ring-1 focus:ring-unifi-blue/30 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-2xl shadow-black/40 max-w-md w-full border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Create DNS Record</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-danger/10 text-danger border border-danger/20 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Domain</span>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DnsType)}
                className={inputClass}
              >
                {DNS_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_RECORD", "").replace("_", " ")}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{valueLabel(type)}</span>
              <input
                value={ip}
                onChange={(e) => { setIp(e.target.value); setFieldError(null); }}
                placeholder={valuePlaceholder(type)}
                className={`${inputClass} ${fieldError ? "!border-danger !focus:ring-danger/30" : ""}`}
              />
              {fieldError && <p className="mt-1.5 text-xs text-danger">{fieldError}</p>}
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">TTL (seconds)</span>
              <input
                type="number"
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
                className={inputClass}
              />
            </label>

            <label className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                  enabled ? "bg-unifi-blue" : "bg-border"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                }`} />
              </button>
              <span className="text-sm text-text-secondary">Enabled</span>
            </label>

            <div className="flex gap-3 mt-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving || !domain || !ip}
                className="flex-1 h-10 bg-unifi-blue text-white rounded-lg hover:bg-unifi-blue-hover transition-colors text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Record"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 h-10 bg-surface-raised border border-border rounded-lg text-sm font-medium text-text-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
