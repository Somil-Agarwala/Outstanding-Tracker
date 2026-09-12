"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Inbox, Plus, Search } from "lucide-react";
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
import { COLLECTION_STATUS_LABELS } from "@/lib/constants";
import { exportCollections } from "@/lib/export";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, formatNumber, pluralize } from "@/lib/utils";
import type { CollectionStatus } from "@/types";
import { CollectionStatusBadge } from "./collection-status-badge";
import { NewCollectionDialog } from "./new-collection-dialog";

export function CollectionsView() {
  const { collections, companies, countLines, deleteCollections } = useStore();
  const [statusFilter, setStatusFilter] = useState<"all" | CollectionStatus>("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const enriched = useMemo(
    () =>
      collections.map((collection) => {
        const lines = countLines.filter((l) => l.collectionId === collection.id);
        return {
          ...collection,
          countedPieces: lines.reduce((sum, l) => sum + l.quantity, 0),
          countedValue: lines.reduce((sum, l) => sum + l.quantity * l.mrp, 0),
        };
      }),
    [collections, countLines]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      const distributor = distributors.find((d) => d.id === c.distributorId);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesCompany = companyFilter === "all" || c.companyId === companyFilter;
      const matchesParty = partyFilter === "all" || c.distributorId === partyFilter;
      const matchesSearch =
        q === "" || c.bagNumber.toLowerCase().includes(q) || (distributor?.name.toLowerCase().includes(q) ?? false);
      return matchesStatus && matchesCompany && matchesParty && matchesSearch;
    });
  }, [enriched, statusFilter, companyFilter, partyFilter, search]);

  const uncountedCount = enriched.filter((c) => c.status === "uncounted").length;
  const awaitingPackPieces = countLines.filter((l) => !l.packed).reduce((sum, l) => sum + l.quantity, 0);
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

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
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4500);
  }

  function handleDelete() {
    const count = selectedIds.size;
    const ok = window.confirm(
      `Delete ${count} ${pluralize(count, "collection bag")}? Any counted lines inside will be removed too. This cannot be undone.`
    );
    if (!ok) return;
    deleteCollections(Array.from(selectedIds));
    setSelectedIds(new Set());
    flash(`${count} ${pluralize(count, "collection bag")} deleted.`);
  }

  return (
    <div className={selectedIds.size > 0 ? "pb-24" : ""}>
      <PageHeader
        title="Collections"
        description="Bags picked up from parties, before and after counting"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => exportCollections({ collections: filtered, countLines, distributors, companies })}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Log collection
            </Button>
          </>
        }
      />

      <Notice message={notice} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Waiting to be counted" value={String(uncountedCount)} tone={uncountedCount > 0 ? "amber" : "default"} />
        <StatCard label="Counted, not yet packed" value={`${formatNumber(awaitingPackPieces)} pcs`} tone={awaitingPackPieces > 0 ? "accent" : "default"} />
        <StatCard label="Collection bags on record" value={String(collections.length)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bag number or party" className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | CollectionStatus)} className="sm:w-40">
            <option value="all">All statuses</option>
            {Object.entries(COLLECTION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="sm:w-44">
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)} className="sm:w-52">
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
            className="text-sm font-medium text-accent hover:text-accent-hi disabled:pointer-events-none disabled:text-ink-faint"
          >
            {allFilteredSelected ? "Clear selection" : `Select all ${filtered.length}`}
          </button>
          <p className="text-sm text-ink-dim">{filtered.length} {pluralize(filtered.length, "bag")}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={Inbox}
            title="No collection bags match these filters"
            description="Log a collection when you pick damaged stock up from a party."
            action={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Log collection</Button>}
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
                  <TableHead>Party</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pieces</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const distributor = distributors.find((d) => d.id === c.distributorId);
                  const company = companies.find((co) => co.id === c.companyId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <label className="flex h-6 w-6 cursor-pointer items-center justify-center">
                          <Checkbox checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                        </label>
                      </TableCell>
                      <TableCell>
                        <Link href={`/collections/${c.id}`} className="font-mono text-xs font-medium text-accent hover:text-accent-hi">
                          {c.bagNumber}
                        </Link>
                      </TableCell>
                      <TableCell><Badge tone="accent">{company?.name}</Badge></TableCell>
                      <TableCell className="text-ink-dim">{distributor?.name}</TableCell>
                      <TableCell><CollectionStatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-ink">
                        {c.status === "uncounted"
                          ? c.estimatedPieces
                            ? `~${formatNumber(c.estimatedPieces)}`
                            : "Not counted"
                          : formatNumber(c.countedPieces)}
                      </TableCell>
                      <TableCell className="text-ink">{c.status === "uncounted" ? "—" : formatCurrency(c.countedValue)}</TableCell>
                      <TableCell className="text-ink-dim">{new Date(c.collectedDate).toLocaleDateString("en-IN")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((c) => {
              const distributor = distributors.find((d) => d.id === c.distributorId);
              const company = companies.find((co) => co.id === c.companyId);
              return (
                <div key={c.id} className="flex items-start gap-1 rounded-xl border border-line bg-surface p-3 pr-4">
                  <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
                    <Checkbox checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  </label>
                  <Link href={`/collections/${c.id}`} className="min-w-0 flex-1 py-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-medium text-ink">{c.bagNumber}</p>
                        <p className="mt-0.5 truncate text-sm text-ink-dim">
                          {company?.name} · {distributor?.name}
                        </p>
                      </div>
                      <CollectionStatusBadge status={c.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                      <div>
                        <p className="text-xs text-ink-faint">Pieces</p>
                        <p className="text-sm font-medium text-ink">
                          {c.status === "uncounted"
                            ? c.estimatedPieces
                              ? `~${formatNumber(c.estimatedPieces)}`
                              : "Not counted"
                            : formatNumber(c.countedPieces)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Value</p>
                        <p className="text-sm font-medium text-ink">{c.status === "uncounted" ? "—" : formatCurrency(c.countedValue)}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}

      <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button size="sm" variant="danger" onClick={handleDelete}>
          Delete {pluralize(selectedIds.size, "bag")}
        </Button>
      </BulkActionBar>

      <NewCollectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(message) => flash(message)}
      />
    </div>
  );
}
