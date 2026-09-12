"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { nextCollectionNumber } from "@/lib/bag-packing";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { pluralize, today } from "@/lib/utils";

const QUICK_COUNTS = [1, 2, 5, 10];

// Logging a pickup is the fast path: pick the party, say how many bags
// came back, done. A pickup is rarely a single bag, so the count sits
// right next to the party rather than being buried as an advanced option.
export function NewCollectionDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const { addCollections, collections, companies } = useStore();
  const [companyId, setCompanyId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [collectedDate, setCollectedDate] = useState(today());
  const [bagCount, setBagCount] = useState("1");
  const [estimatedPieces, setEstimatedPieces] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const parsedCount = Math.max(1, Math.floor(Number(bagCount) || 1));

  // Preview the exact numbers before anything is created, so nobody has
  // to generate 20 bags to find out what they will be called. Numbering
  // runs per company, so the preview needs the chosen company first.
  const company = companies.find((c) => c.id === companyId);
  const existingForCompany = collections.filter((c) => c.companyId === companyId).length;
  const firstNumber = company ? nextCollectionNumber(company.code, existingForCompany, collectedDate) : "";
  const lastNumber = company ? nextCollectionNumber(company.code, existingForCompany + parsedCount - 1, collectedDate) : "";

  function reset() {
    setCompanyId("");
    setDistributorId("");
    setCollectedDate(today());
    setBagCount("1");
    setEstimatedPieces("");
    setNotes("");
  }

  function handleCreate() {
    if (!companyId || !distributorId) return;
    const created = addCollections(
      {
        companyId,
        distributorId,
        collectedDate,
        estimatedPieces: estimatedPieces === "" ? undefined : Number(estimatedPieces),
        notes: notes.trim() || undefined,
      },
      parsedCount
    );

    const message =
      created.length === 1
        ? `${created[0].bagNumber} created and marked as not counted.`
        : `${created.length} bags created, ${created[0].bagNumber} to ${created[created.length - 1].bagNumber}.`;

    onCreated(message);
    reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-line-strong bg-surface sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Log a collection</h2>
            <p className="mt-0.5 text-sm text-ink-dim">Record the bags now, count them later.</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-elevated" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <Label htmlFor="company">Company</Label>
            <Select id="company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Select a company</option>
              {companies.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-ink-faint">
              One bag holds one company. If a pickup has mixed brands, log a separate bag for each.
            </p>
          </div>

          <div>
            <Label htmlFor="party">Party</Label>
            <Select id="party" value={distributorId} onChange={(e) => setDistributorId(e.target.value)}>
              <option value="">Select a party</option>
              {distributors.filter((d) => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="bagCount">How many bags came back?</Label>
            <div className="flex gap-2">
              <Input
                id="bagCount"
                type="number"
                min={1}
                value={bagCount}
                onChange={(e) => setBagCount(e.target.value)}
                className="w-28"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COUNTS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setBagCount(String(count))}
                    className={`h-10 min-w-[44px] rounded-lg px-3 text-sm font-medium transition-colors ${
                      parsedCount === count ? "bg-accent text-accent-ink" : "bg-elevated text-ink-dim hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              {!company
                ? "Choose a company to see the bag numbers that will be generated."
                : parsedCount === 1
                  ? `This will create ${firstNumber}.`
                  : `This will create ${parsedCount} separate bags, ${firstNumber} to ${lastNumber}, each countable on its own.`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="collectedDate">Collected on</Label>
              <Input id="collectedDate" type="date" value={collectedDate} onChange={(e) => setCollectedDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="estimatedPieces">Rough pieces per bag</Label>
              <Input
                id="estimatedPieces"
                type="number"
                min={0}
                placeholder="Optional"
                value={estimatedPieces}
                onChange={(e) => setEstimatedPieces(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="collectionNotes">Notes</Label>
            <Textarea
              id="collectionNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={parsedCount > 1 ? "Applied to every bag in this pickup" : "Anything worth noting at pickup"}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!companyId || !distributorId}>
            Generate {parsedCount} {pluralize(parsedCount, "bag")}
          </Button>
        </div>
      </div>
    </div>
  );
}
