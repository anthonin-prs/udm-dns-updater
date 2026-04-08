"use client";

import { useState, useEffect, useCallback } from "react";
import { DnsRecord } from "@/lib/types";
import RecordDetailModal from "@/components/RecordDetailModal";
import CreateRecordModal from "@/components/CreateRecordModal";

export default function DnsTable() {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DnsRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronStatus, setCronStatus] = useState<{ timestamp: string; ok: boolean; message: string } | null>(null);
  const [npmIp, setNpmIp] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dns");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRecords(Array.isArray(json) ? json : json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    // Fetch cron status on load
    fetch("/api/cron").then(r => r.json()).then(data => {
      if (data.lastRun) setCronStatus(data.lastRun);
      if (data.npmIp) setNpmIp(data.npmIp);
    }).catch(() => {});
  }, [fetchRecords]);

  async function triggerCron() {
    setCronRunning(true);
    try {
      const res = await fetch("/api/cron", { method: "POST" });
      const result = await res.json();
      setCronStatus(result);
      fetchRecords();
    } catch {
      setCronStatus({ timestamp: new Date().toISOString(), ok: false, message: "Request failed" });
    } finally {
      setCronRunning(false);
    }
  }

  const getIp = (r: DnsRecord) =>
    r.ipv4Address || r.ipv6Address || r.value || "—";

  const getId = (r: DnsRecord) => r._id || r.id || r.key || "";

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const manualRecords = records.filter((r) => !npmIp || r.ipv4Address !== npmIp);
    if (selectedIds.size === manualRecords.length && manualRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(manualRecords.map(getId)));
    }
  }

  async function toggleEnabled(r: DnsRecord) {
    const id = getId(r);
    try {
      const body: Record<string, unknown> = {
        type: r.type,
        enabled: !r.enabled,
        domain: r.domain,
        ttlSeconds: r.ttlSeconds,
      };
      if (r.ipv4Address) body.ipv4Address = r.ipv4Address;
      if (r.ipv6Address) body.ipv6Address = r.ipv6Address;
      if (r.value) body.value = r.value;
      const res = await fetch(`/api/dns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchRecords();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} record(s)?`)) return;
    setBulkDeleting(true);
    setError(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/dns/${id}`, { method: "DELETE" }).then((res) => {
            if (!res.ok) throw new Error(`Failed to delete ${id}`);
          })
        )
      );
      setSelectedIds(new Set());
      fetchRecords();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">UDM DNS Records</h1>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {bulkDeleting ? "Deleting…" : `Delete (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New Record
          </button>
          <button
            onClick={triggerCron}
            disabled={cronRunning}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
            title={cronStatus ? `Last run: ${cronStatus.timestamp}` : "No runs yet"}
          >
            {cronRunning ? "Running…" : "Run Job"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : (() => {
        const manualRecords = records.filter((r) => !npmIp || r.ipv4Address !== npmIp);
        const npmRecords = npmIp ? records.filter((r) => r.ipv4Address === npmIp) : [];

        return (
          <>
            {/* Manual DNS Records */}
            {manualRecords.length === 0 && npmRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No DNS records found.</div>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === manualRecords.length && manualRecords.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Domain</th>
                        <th className="px-4 py-3 font-medium">IP / Value</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Enabled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {manualRecords.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No manual records.</td></tr>
                      ) : manualRecords.map((r) => {
                        const rid = getId(r);
                        return (
                          <tr
                            key={rid}
                            onClick={() => setSelected(r)}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                              selectedIds.has(rid) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                            }`}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(rid)}
                                onChange={() => toggleSelect(rid)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 font-mono">{r.domain}</td>
                            <td className="px-4 py-3 font-mono">{getIp(r)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium">
                                {r.type}
                              </span>
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleEnabled(r)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  r.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                    r.enabled ? "translate-x-4" : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* NPM-synced Records */}
                {npmRecords.length > 0 && (
                  <>
                    <h2 className="text-lg font-semibold mt-8 mb-3 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      NPM Synced Records
                      <span className="text-xs font-normal text-gray-500">→ {npmIp}</span>
                    </h2>
                    <div className="overflow-hidden rounded-lg border border-green-700/30">
                      <table className="w-full text-sm">
                        <thead className="bg-green-900/20 text-left">
                          <tr>
                            <th className="px-4 py-3 font-medium">Domain</th>
                            <th className="px-4 py-3 font-medium">IP</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Enabled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-700/20">
                          {npmRecords.map((r) => {
                            const rid = getId(r);
                            return (
                              <tr
                                key={rid}
                                onClick={() => setSelected(r)}
                                className="hover:bg-green-900/10 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3 font-mono">{r.domain}</td>
                                <td className="px-4 py-3 font-mono">{getIp(r)}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded bg-green-900/30 text-xs font-medium">
                                    {r.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => toggleEnabled(r)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                      r.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                        r.enabled ? "translate-x-4" : "translate-x-0.5"
                                      }`}
                                    />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        );
      })()}

      {selected && (
        <RecordDetailModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            fetchRecords();
          }}
        />
      )}

      {showCreate && (
        <CreateRecordModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchRecords();
          }}
        />
      )}
    </div>
  );
}
