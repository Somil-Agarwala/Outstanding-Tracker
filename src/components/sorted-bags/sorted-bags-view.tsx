"use client";

import { useMemo, useState } from "react";
import { Download, PackageOpen, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildMrpTiers } from "@/lib/bag-packing";
import { SORTED_BAG_STATUS_LABELS, SORTED_BAG_STATUS_TONE } from "@/lib/constants";
import { exportSortedBags } from "@/lib/export";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, formatNumber, pluralize } from "@/lib/utils";
import type { SortedBagStatus } from "@/types";
import { PackingPanel } from "./packing-panel";

export function SortedBagsView() {
  const { sortedBags, companies, countLines, collections, products, packPendingLines, deleteSortedBags, createDispatch } = useStore();
  const [statusFilter, setStatusFilter] = useState<"all" | SortedBagStatus>("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [mrpFilter, setMrpFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const tiers = useMemo(() => buildMrpTiers(countLines), [countLines]);
  const mrpOptions = useMemo(
    () => Array.from(new Set(sortedBags.map((b) => b.mrp))).sort((a, b) => a - b),
    [sortedBags]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedBags.filter((bag) => {
      const matchesStatus = statusFilter === "all" || bag.status === statusFilter;
      const matchesCompany = companyFilter === "all" || bag.companyId === companyFilter;
      const matchesMrp = mrpFilter === "all" || bag.mrp === Number(mrpFilter);
      const matchesSearch = q === "" || bag.bagNumber.toLowerCase().includes(q);
      const matchesParty =
        partyFilter === "all" ||
        bag.sourceCollectionIds.some((id) => collections.find((c) => c.id === id)?.distributorId === partyFilter);
      return matchesStatus && matchesCompany && matchesMrp && matchesSearch && matchesParty;
    });
  }, [sortedBags, statusFilter, companyFilter, mrpFilter, partyFilter, search, collections]);

  const readyBags = sortedBags.filter((b) => b.status === "ready");
  const readyValue = readyBags.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0);
  const allFilteredSelected = filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));
  const selectedBags = sortedBags.filter((b) => selectedIds.has(b.id));
  const selectedReady = selectedBags.filter((b) => b.status === "ready");
  // A dispatch goes to one factory, so a mixed-company selection cannot
  // be sent. Surfaced as a message rather than a silent no-op.
  const selectedCompanyIds = Array.from(new Set(selectedReady.map((b) => b.companyId)));
  const isSingleCompany = selectedCompanyIds.length === 1;
  const selectedCompanyName = companies.find((c) => c.id === selectedCompanyIds[0])?.name ?? "";

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 5000);
  }

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
      if (allFilteredSelected) filtered.forEach((b) => next.delete(b.id));
      else filtered.forEach((b) => next.add(b.id));
      return next;
    });
  }

  function handlePack() {
    const result = packPendingLines();
    if (result.bagCount === 0) return;
    flash(`${result.bagCount} ${pluralize(result.bagCount, "bag")} generated holding ${formatNumber(result.pieceCount)} pieces.`);
  }

  function handleDelete() {
    const count = selectedIds.size;
    const ok = window.confirm(`Delete ${count} ${pluralize(count, "bag")}? This cannot be undone.`);
    if (!ok) return;
    deleteSortedBags(Array.from(selectedIds));
    setSelectedIds(new Set());
    flash(`${count} ${pluralize(count, "bag")} deleted.`);
  }

  function handleDispatch() {
    const count = selectedReady.length;
    if (!isSingleCompany) return;
    const ok = window.confirm(
      `Send ${count} ${pluralize(count, "bag")} to the ${selectedCompanyName} factory? This creates a dispatch record you can download as a report.`
    );
    if (!ok) return;
    const dispatch = createDispatch(selectedReady.map((b) => b.id));
    setSelectedIds(new Set());
    if (dispatch) {
      flash(`${dispatch.dispatchNumber} created with ${dispatch.bagCount} bags worth ${formatCurrency(dispatch.claimedValue)}.`);
    }
  }

  function handleExport() {
    exportSortedBags({
      bags: filtered,
      collections,
      countLines,
      distributors,
      products,
      companies,
      filterLabel: statusFilter === "all" ? undefined : SORTED_BAG_STATUS_LABELS[statusFilter],
    });
  }

  return (
    <div className={selectedIds.size > 0 ? "pb-24" : ""}>
      <PageHeader
        title="Sorted bags"
        description="Counted pieces packed by MRP, ready to carry to the factory"
        actions={
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export report
          </Button>
        }
      />

      <Notice message={notice} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ready to send" value={String(readyBags.length)} tone={readyBags.length > 0 ? "accent" : "default"} />
        <StatCard label="Value ready" value={formatCurrency(readyValue)} />
        <StatCard label="Pieces ready" value={formatNumber(readyBags.reduce((s, b) => s + b.pieceCount, 0))} />
        <StatCard label="Bags on record" value={String(sortedBags.length)} />
      </div>

      <PackingPanel tiers={tiers} onPack={handlePack} />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative sm:w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bag number" className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | SortedBagStatus)} className="sm:w-40">
            <option value="all">All statuses</option>
            {Object.entries(SORTED_BAG_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="sm:w-44">
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={mrpFilter} onChange={(e) => setMrpFilter(e.target.value)} className="sm:w-36">
            <option value="all">All MRP</option>
            {mrpOptions.map((mrp) => (
              <option key={mrp} value={String(mrp)}>MRP {mrp}</option>
            ))}
          </Select>
          <Select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)} className="sm:w-48">
            <option value="all">All parties</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
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
          <p className="whitespace-nowrap text-sm text-ink-dim">{filtered.length} {pluralize(filtered.length, "bag")}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={PackageOpen}
            title="No sorted bags match these filters"
            description="Count a collection bag first, then pack the pieces into MRP bags here."
          />
        </div>
      ) : (
        <>
          <div className="hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Bag number</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Pieces</TableHead>
                  <TableHead>Fill</TableHead>
                  <TableHead>Claim value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((bag) => (
                  <TableRow key={bag.id}>
                    <TableCell>
                      <label className="flex h-6 w-6 cursor-pointer items-center justify-center">
                        <Checkbox checked={selectedIds.has(bag.id)} onChange={() => toggleSelect(bag.id)} />
                      </label>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-ink">{bag.bagNumber}</TableCell>
                    <TableCell><Badge tone="accent">{companies.find((c) => c.id === bag.companyId)?.name}</Badge></TableCell>
                    <TableCell className="text-ink-dim">{formatCurrency(bag.mrp)}</TableCell>
                    <TableCell className="text-ink">{formatNumber(bag.pieceCount)}</TableCell>
                    <TableCell>
                      <Badge tone={bag.isFull ? "emerald" : "neutral"}>{bag.isFull ? "Full" : "Part-filled"}</Badge>
                    </TableCell>
                    <TableCell className="text-ink">{formatCurrency(bag.pieceCount * bag.mrp)}</TableCell>
                    <TableCell>
                      <Badge tone={SORTED_BAG_STATUS_TONE[bag.status]}>{SORTED_BAG_STATUS_LABELS[bag.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-ink-dim">{formatDate(bag.createdDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((bag) => (
              <div key={bag.id} className="flex items-start gap-1 rounded-xl border border-line bg-surface p-3 pr-4">
                <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
                  <Checkbox checked={selectedIds.has(bag.id)} onChange={() => toggleSelect(bag.id)} />
                </label>
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-ink">{bag.bagNumber}</p>
                      <p className="mt-0.5 text-sm text-ink-dim">
                        {companies.find((c) => c.id === bag.companyId)?.name} · MRP {formatCurrency(bag.mrp)}
                      </p>
                    </div>
                    <Badge tone={SORTED_BAG_STATUS_TONE[bag.status]}>{SORTED_BAG_STATUS_LABELS[bag.status]}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <div>
                      <p className="text-xs text-ink-faint">Pieces</p>
                      <p className="text-sm font-medium text-ink">{formatNumber(bag.pieceCount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Fill</p>
                      <p className="text-sm font-medium text-ink">{bag.isFull ? "Full" : "Part"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Value</p>
                      <p className="text-sm font-medium text-ink">{formatCurrency(bag.pieceCount * bag.mrp)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        {selectedReady.length > 0 && isSingleCompany && (
          <Button size="sm" onClick={handleDispatch}>
            <Send className="h-4 w-4" /> Send {selectedReady.length} to {selectedCompanyName}
          </Button>
        )}
        {selectedReady.length > 0 && !isSingleCompany && (
          <span className="text-sm text-amber-300">
            Selection spans {selectedCompanyIds.length} companies. Each factory needs its own dispatch.
          </span>
        )}
        <Button size="sm" variant="danger" onClick={handleDelete}>
          Delete {pluralize(selectedIds.size, "bag")}
        </Button>
      </BulkActionBar>
    </div>
  );
}
