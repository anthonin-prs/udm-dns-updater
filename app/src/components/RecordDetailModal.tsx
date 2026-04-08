"use client";

import { useState } from "react";
import { DnsRecord, DNS_TYPES } from "@/lib/types";
import { validateValue, valuePlaceholder, valueLabel } from "@/lib/validation";

interface Props {
  record: DnsRecord;
  onClose: () => void;
  onUpdated: () => void;
}

export default function RecordDetailModal({ record, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState(record.domain);
  const [type, setType] = useState(record.type);
  const [ip, setIp] = useState(record.ipv4Address || record.ipv6Address || record.value || "");
  const [ttl, setTtl] = useState(record.ttlSeconds ?? 60);
  const [enabled, setEnabled] = useState(record.enabled);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const id = record._id || record.id || record.key;

  async function handleUpdate() {
    const valErr = validateValue(type, ip);
    if (valErr) { setFieldError(valErr); return; }
    setFieldError(null);
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { type, enabled, domain, ttlSeconds: ttl };
      if (type === "AAAA_RECORD") body.ipv6Address = ip;
      else if (["CNAME_RECORD","MX_RECORD","TXT_RECORD","SRV_RECORD","FORWARD_DOMAIN"].includes(type)) body.value = ip;
      else body.ipv4Address = ip;
      const res = await fetch(`/api/dns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || `HTTP ${res.status}`); }
      onUpdated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Update failed"); }
    finally { setSaving(false); }
  }

  async function handleToggle() {
    setToggling(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { type: record.type, enabled: !enabled, domain: record.domain, ttlSeconds: record.ttlSeconds ?? 60 };
      if (record.type === "AAAA_RECORD") body.ipv6Address = ip;
      else if (["CNAME_RECORD","MX_RECORD","TXT_RECORD","SRV_RECORD","FORWARD_DOMAIN"].includes(record.type)) body.value = ip;
      else body.ipv4Address = ip;
      const res = await fetch(`/api/dns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || `HTTP ${res.status}`); }
      setEnabled(!enabled);
      onUpdated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Update failed"); }
    finally { setToggling(false); }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this DNS record?")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dns/${id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || `HTTP ${res.status}`); }
      onUpdated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  }

  const inputClass =
    "mt-1.5 w-full h-10 px-3 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-unifi-blue focus:ring-1 focus:ring-unifi-blue/30 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-2xl shadow-black/40 max-w-md w-full max-h-[90vh] overflow-y-auto border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{editing ? "Edit Record" : "Record Details"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-foreground hover:bg-surface-hover transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">
          {error && (<div className="mb-4 p-3 bg-danger/10 text-danger border border-danger/20 rounded-lg text-sm">{error}</div>)}
          {!editing ? (
            <>
              <div className="space-y-3">
                <DetailRow label="Domain" value={record.domain} mono />
                <DetailRow label="Type" value={record.type.replace("_RECORD", "").replace("_", " ")} />
                <DetailRow label="Value" value={record.ipv4Address || record.ipv6Address || record.value || "\u2014"} mono />
                <DetailRow label="TTL" value={`${record.ttlSeconds ?? "\u2014"}s`} />
                <DetailRow label="Enabled" value={record.enabled ? "Active" : "Disabled"} color={record.enabled ? "text-success" : "text-text-tertiary"} />
                {record.origin && <DetailRow label="Origin" value={record.origin} />}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditing(true)} className="flex-1 h-10 bg-unifi-blue text-white rounded-lg hover:bg-unifi-blue-hover transition-colors text-sm font-medium">Edit</button>
                <button onClick={handleToggle} disabled={toggling} className={`flex-1 h-10 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${enabled ? "bg-warning/10 text-warning hover:bg-warning/20" : "bg-success/10 text-success hover:bg-success/20"}`}>{toggling ? (enabled ? "Disabling\u2026" : "Enabling\u2026") : (enabled ? "Disable" : "Enable")}</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 h-10 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors text-sm font-medium disabled:opacity-50">{deleting ? "Deleting\u2026" : "Delete"}</button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Domain</span>
                <input value={domain} onChange={(e) => setDomain(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Type</span>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                  {DNS_TYPES.map((t) => (<option key={t} value={t}>{t.replace("_RECORD", "").replace("_", " ")}</option>))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{valueLabel(type)}</span>
                <input value={ip} onChange={(e) => { setIp(e.target.value); setFieldError(null); }} placeholder={valuePlaceholder(type)} className={`${inputClass} ${fieldError ? "!border-danger" : ""}`} />
                {fieldError && <p className="mt-1.5 text-xs text-danger">{fieldError}</p>}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">TTL (seconds)</span>
                <input type="number" value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className={inputClass} />
              </label>
              <label className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => setEnabled(!enabled)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${enabled ? "bg-unifi-blue" : "bg-border"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                </button>
                <span className="text-sm text-text-secondary">Enabled</span>
              </label>
              <div className="flex gap-3 mt-2 pt-2">
                <button onClick={handleUpdate} disabled={saving} className="flex-1 h-10 bg-unifi-blue text-white rounded-lg hover:bg-unifi-blue-hover transition-colors text-sm font-medium disabled:opacity-50">{saving ? "Saving\u2026" : "Save Changes"}</button>
                <button onClick={() => setEditing(false)} className="flex-1 h-10 bg-surface-raised border border-border rounded-lg text-sm font-medium text-text-secondary hover:text-foreground hover:bg-surface-hover transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""} ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}