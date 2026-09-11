"use client";

import { useState } from "react";
import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { adjustOwnInventoryAction } from "@/app/(org)/inventoryActions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fieldControlClassName, fieldControlErrorClassName } from "@/components/ui/FormField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";
import type { BloodInventoryItem } from "@/types/domain";
import type { OrganizationType } from "@/lib/escalation/constants";

/**
 * Blood inventory — presentation only.
 *
 * Same contracts as before: inventory is always exactly one record per
 * blood group (`inventoryService.getOwnInventory` fills in unrecorded
 * groups at 0 units), edits are delta adjustments through
 * `adjustOwnInventoryAction`, and there is no add/delete of records and no
 * derived availability field. Nothing here recalculates stock.
 */

/** The service falls back to this exact sentinel when a group has no row yet. */
const NEVER_RECORDED_ISO = new Date(0).toISOString();

function formatUpdated(updatedAt: string): string {
  if (updatedAt === NEVER_RECORDED_ISO) return "Not yet recorded";
  return `Updated ${new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function OrganizationInventoryPanel({
  organizationType,
  initialItems,
}: {
  organizationType: OrganizationType;
  initialItems: BloodInventoryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busyGroup, setBusyGroup] = useState<BloodGroup | null>(null);
  const [rowError, setRowError] = useState<{ group: BloodGroup; message: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function adjust(bloodGroup: BloodGroup, sign: 1 | -1) {
    if (busyGroup) return;
    setInfo(null);

    const raw = amounts[bloodGroup] ?? "1";
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) {
      setRowError({ group: bloodGroup, message: "Enter a positive whole number of units." });
      return;
    }
    setRowError(null);

    const delta = sign * amount;
    setBusyGroup(bloodGroup);
    const result = await adjustOwnInventoryAction(organizationType, {
      bloodGroup,
      delta,
      reason: reason.trim() || null,
    });
    setBusyGroup(null);

    if ("error" in result) {
      setRowError({ group: bloodGroup, message: result.error });
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.bloodGroup === bloodGroup
          ? { ...item, unitsAvailable: result.unitsAvailable, updatedAt: new Date().toISOString() }
          : item
      )
    );
    setInfo(
      `${BLOOD_GROUP_LABELS[bloodGroup]} updated: ${result.oldUnits} → ${result.newUnits} (Δ ${
        result.delta > 0 ? `+${result.delta}` : result.delta
      }).`
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="inventory-context-heading" className="flex flex-col gap-3">
        <SectionHeader id="inventory-context-heading" title="Inventory status" />
        <Alert variant="info">
          Available units only. Adjustments are atomic and audited. CAN_SUPPLY does not change
          stock.
        </Alert>
      </section>

      <section aria-labelledby="inventory-records-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="inventory-records-heading"
          title="Blood group inventory"
          count={items.length}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="inventory-reason" className="text-label text-text">
            Reason
          </label>
          <input
            id="inventory-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            placeholder="e.g. Restock delivery"
            aria-describedby="inventory-reason-helper"
            className={fieldControlClassName}
          />
          <p id="inventory-reason-helper" className="text-caption text-text-tertiary">
            Optional. Applied to the next Add or Remove you make below.
          </p>
        </div>

        <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const busy = busyGroup === item.bloodGroup;
            const invalid = rowError?.group === item.bloodGroup;
            const label = BLOOD_GROUP_LABELS[item.bloodGroup];
            const headingId = `inventory-${item.bloodGroup}-heading`;
            const amountId = `inventory-${item.bloodGroup}-amount`;
            const errorId = `inventory-${item.bloodGroup}-error`;

            return (
              <li key={item.bloodGroup}>
                <div
                  role="group"
                  aria-labelledby={headingId}
                  className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 id={headingId} className="text-h3 text-text">
                      {label}
                    </h3>
                    <span className="text-caption text-text-tertiary">
                      {formatUpdated(item.updatedAt)}
                    </span>
                  </div>

                  <p className="text-body text-text-secondary">
                    <span className="text-h2 tabular-nums text-text">{item.unitsAvailable}</span>{" "}
                    units available
                  </p>

                  <div className="flex flex-col gap-1">
                    <label htmlFor={amountId} className="text-label text-text">
                      Amount
                    </label>
                    <input
                      id={amountId}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={amounts[item.bloodGroup] ?? "1"}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [item.bloodGroup]: event.target.value,
                        }))
                      }
                      disabled={busy}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? errorId : undefined}
                      className={cn(
                        fieldControlClassName,
                        "max-w-[7rem]",
                        invalid && fieldControlErrorClassName
                      )}
                    />
                    {invalid && (
                      <p id={errorId} role="alert" className="text-caption text-danger">
                        {rowError.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyGroup !== null}
                      loading={busy}
                      loadingLabel="Adding…"
                      aria-label={`Add units to ${label}`}
                      onClick={() => void adjust(item.bloodGroup, 1)}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyGroup !== null}
                      loading={busy}
                      loadingLabel="Removing…"
                      aria-label={`Remove units from ${label}`}
                      onClick={() => void adjust(item.bloodGroup, -1)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {info && <Alert variant="success">{info}</Alert>}
    </div>
  );
}
