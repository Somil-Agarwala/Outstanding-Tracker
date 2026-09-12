"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Download, PlusCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REASON_LABELS, SOURCE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { exportRecords } from "@/lib/export";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, pluralize } from "@/lib/utils";
import type { ReasonCategory, ResolutionStatus } from "@/types";
import { StatusBadge } from "./status-badge";

export function RecordsView() {
  const { records, products, companies, deleteRecords } = useStore();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "own_inventory" | "distributor">("all");
  const [reasonFilter, setReasonFilter] = useState<"all" | ReasonCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ResolutionStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const product = products.find((p) => p.id === r.productId);
      const matchesSearch =
        q === "" ||
        (product?.name.toLowerCase().includes(q) ?? false) ||
        (product?.sku.toLowerCase().includes(q) ?? false) ||
        r.batchNumber.toLowerCase().includes(q);
      const matchesSource = sourceFilter === "all" || r.source === sourceFilter;
      const matchesReason = reasonFilter === "all" || r.reason === reasonFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesSource && matchesReason && matchesStatus;
    });
  }, [records, products, search, sourceFilter, reasonFilter, statusFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function handleDelete() {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} ${pluralize(count, "record")}? This cannot be undone.`)) return;
    deleteRecords(Array.from(selectedIds));
    setSelectedIds(new Set());
    setNotice(`${count} ${pluralize(count, "record")} deleted.`);
    window.setTimeout(() => setNotice(null), 4000);
  }

  return (
    <div className={selectedIds.size > 0 ? "pb-24" : ""}>
      <PageHeader
        title="All records"
        description="Damage and expiry logged against your own inventory"
        actions={
          <>
            <Button variant="outline" onClick={() => exportRecords({ records: filtered, products, distributors, companies })} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Link href="/new-entry" className={buttonVariants()}>
              <PlusCircle className="h-4 w-4" /> New entry
            </Link>
          </>
        }
      />

      <Notice message={notice} />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative sm:w-52">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, product or batch" className="pl-9" />
          </div>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)} className="sm:w-40">
            <option value="all">All sources</option>
            <option value="own_inventory">Own inventory</option>
            <option value="distributor">Party</option>
          </Select>
          <Select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value as "all" | ReasonCategory)} className="sm:w-48">
            <option value="all">All reasons</option>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ResolutionStatus)} className="sm:w-48">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSelectAll}
            disabled={filtered.length === 0}
            className="whitespace-nowrap text-sm font-medium text-accent hover:text-accent-hi disabled:pointer-events-none disabled:text-ink-faint"
          >
            {allFilteredSelected ? "Clear selection" : `Select all ${filtered.length}`}
          </button>
          <p className="whitespace-nowrap text-sm text-ink-dim">{filtered.length} {pluralize(filtered.length, "record")}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={ClipboardList} title="No records match these filters" description="Try clearing a filter above." />
        </div>
      ) : (
        <>
          <div className="hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const product = products.find((p) => p.id === r.productId);
                  const distributor = distributors.find((d) => d.id === r.distributorId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <label className="flex h-6 w-6 cursor-pointer items-center justify-center">
                          <Checkbox checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                        </label>
                      </TableCell>
                      <TableCell className="text-ink-dim">{formatDate(r.date)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-ink">{product?.name}</p>
                        <p className="text-xs text-ink-faint">{product?.sku}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-ink-faint">{r.batchNumber}</TableCell>
                      <TableCell>
                        <Badge tone={r.source === "own_inventory" ? "neutral" : "blue"}>
                          {r.source === "own_inventory" ? SOURCE_LABELS.own_inventory : distributor?.name ?? SOURCE_LABELS.distributor}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink">{r.quantity} {r.unit}</TableCell>
                      <TableCell className="text-ink-dim">{REASON_LABELS[r.reason]}</TableCell>
                      <TableCell className="text-ink">{formatCurrency(r.costValue)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const product = products.find((p) => p.id === r.productId);
              return (
                <div key={r.id} className="flex items-start gap-1 rounded-xl border border-line bg-surface p-3 pr-4">
                  <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
                    <Checkbox checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                  </label>
                  <div className="min-w-0 flex-1 py-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{product?.name}</p>
                        <p className="text-xs text-ink-faint">Batch {r.batchNumber}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                      <div>
                        <p className="text-xs text-ink-faint">Qty</p>
                        <p className="text-sm font-medium text-ink">{r.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Cost</p>
                        <p className="text-sm font-medium text-ink">{formatCurrency(r.costValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Reason</p>
                        <p className="truncate text-sm font-medium text-ink">{REASON_LABELS[r.reason]}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button size="sm" variant="danger" onClick={handleDelete}>
          Delete {pluralize(selectedIds.size, "record")}
        </Button>
      </BulkActionBar>
    </div>
  );
}
