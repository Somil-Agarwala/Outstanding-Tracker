"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DISPATCH_STATUS_LABELS, DISPATCH_STATUS_TONE } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, formatNumber, pluralize } from "@/lib/utils";
import type { DispatchStatus } from "@/types";

export function DispatchesView() {
  const { dispatches, companies, deleteDispatches } = useStore();
  const [statusFilter, setStatusFilter] = useState<"all" | DispatchStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(
    () => (statusFilter === "all" ? dispatches : dispatches.filter((d) => d.status === statusFilter)),
    [dispatches, statusFilter]
  );

  const totalClaimed = dispatches.reduce((sum, d) => sum + d.claimedValue, 0);
  const totalReceived = dispatches.reduce((sum, d) => sum + (d.receivedValue ?? 0), 0);
  const outstanding = dispatches
    .filter((d) => d.status !== "settled" && d.status !== "rejected")
    .reduce((sum, d) => sum + (d.claimedValue - (d.receivedValue ?? 0)), 0);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete() {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} ${pluralize(count, "dispatch", "dispatches")}? This cannot be undone.`)) return;
    deleteDispatches(Array.from(selectedIds));
    setSelectedIds(new Set());
    setNotice(`${count} ${pluralize(count, "dispatch", "dispatches")} deleted.`);
    window.setTimeout(() => setNotice(null), 4000);
  }

  return (
    <div className={selectedIds.size > 0 ? "pb-24" : ""}>
      <PageHeader title="Dispatches" description="Factory runs and what came back against each claim" />

      <Notice message={notice} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total claimed" value={formatCurrency(totalClaimed)} />
        <StatCard label="Total received" value={formatCurrency(totalReceived)} tone="accent" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} tone={outstanding > 0 ? "amber" : "default"} />
        <StatCard label="Dispatches" value={String(dispatches.length)} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | DispatchStatus)} className="w-52">
          <option value="all">All statuses</option>
          {Object.entries(DISPATCH_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <p className="text-sm text-ink-dim">{filtered.length} {pluralize(filtered.length, "dispatch", "dispatches")}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={Send}
            title="No dispatches yet"
            description="Select ready bags on the Sorted bags page and send them to the factory."
            action={<Link href="/sorted-bags"><Button variant="outline">Go to sorted bags</Button></Link>}
          />
        </div>
      ) : (
        <>
          <div className="hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Dispatch</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Bags</TableHead>
                  <TableHead>Pieces</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <label className="flex h-6 w-6 cursor-pointer items-center justify-center">
                        <Checkbox checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} />
                      </label>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dispatches/${d.id}`} className="font-mono text-xs font-medium text-accent hover:text-accent-hi">
                        {d.dispatchNumber}
                      </Link>
                    </TableCell>
                    <TableCell><Badge tone="accent">{companies.find((c) => c.id === d.companyId)?.name}</Badge></TableCell>
                    <TableCell className="text-ink-dim">{formatDate(d.sentDate)}</TableCell>
                    <TableCell className="text-ink">{d.bagCount}</TableCell>
                    <TableCell className="text-ink-dim">{formatNumber(d.pieceCount)}</TableCell>
                    <TableCell className="text-ink">{formatCurrency(d.claimedValue)}</TableCell>
                    <TableCell className="text-ink-dim">{d.receivedValue != null ? formatCurrency(d.receivedValue) : "—"}</TableCell>
                    <TableCell><Badge tone={DISPATCH_STATUS_TONE[d.status]}>{DISPATCH_STATUS_LABELS[d.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((d) => (
              <div key={d.id} className="flex items-start gap-1 rounded-xl border border-line bg-surface p-3 pr-4">
                <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
                  <Checkbox checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} />
                </label>
                <Link href={`/dispatches/${d.id}`} className="min-w-0 flex-1 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-ink">{d.dispatchNumber}</p>
                      <p className="mt-0.5 text-sm text-ink-dim">
                        {companies.find((c) => c.id === d.companyId)?.name} · {d.bagCount} bags · {formatNumber(d.pieceCount)} pcs
                      </p>
                    </div>
                    <Badge tone={DISPATCH_STATUS_TONE[d.status]}>{DISPATCH_STATUS_LABELS[d.status]}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                    <div>
                      <p className="text-xs text-ink-faint">Claimed</p>
                      <p className="text-sm font-medium text-ink">{formatCurrency(d.claimedValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Received</p>
                      <p className="text-sm font-medium text-ink">{d.receivedValue != null ? formatCurrency(d.receivedValue) : "—"}</p>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button size="sm" variant="danger" onClick={handleDelete}>
          Delete {pluralize(selectedIds.size, "dispatch", "dispatches")}
        </Button>
      </BulkActionBar>
    </div>
  );
}
