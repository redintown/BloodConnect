"use client";

import { useState } from "react";
import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { adjustOwnInventoryAction } from "@/app/(org)/inventoryActions";
import type { BloodInventoryItem } from "@/types/domain";
import type { OrganizationType } from "@/lib/escalation/constants";

const inputClassName =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emergency focus:ring-1 focus:ring-emergency";

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
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function adjust(bloodGroup: BloodGroup, sign: 1 | -1) {
    setError(null);
    setInfo(null);

    const raw = amounts[bloodGroup] ?? "1";
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a positive whole number of units.");
      return;
    }

    const delta = sign * amount;
    setBusyGroup(bloodGroup);
    const result = await adjustOwnInventoryAction(organizationType, {
      bloodGroup,
      delta,
      reason: reason.trim() || null,
    });
    setBusyGroup(null);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.bloodGroup === bloodGroup
          ? { ...item, unitsAvailable: result.unitsAvailable, id: item.id }
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Available units only. Adjustments are atomic and audited. CAN_SUPPLY does not change stock.
      </p>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Reason (optional)
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={inputClassName}
          maxLength={300}
          placeholder="e.g. Restock delivery"
        />
      </label>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Blood group</th>
              <th className="px-4 py-3 font-semibold">Available</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const busy = busyGroup === item.bloodGroup;
              return (
                <tr key={item.bloodGroup} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {BLOOD_GROUP_LABELS[item.bloodGroup]}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-800">{item.unitsAvailable}</td>
                  <td className="px-4 py-3">
                    <input
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
                      className={`${inputClassName} max-w-[6rem]`}
                      disabled={busy}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || busyGroup !== null}
                        onClick={() => adjust(item.bloodGroup, 1)}
                        className="rounded-lg bg-emergency px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        disabled={busy || busyGroup !== null}
                        onClick={() => adjust(item.bloodGroup, -1)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {info && <p className="text-sm text-green-700">{info}</p>}
    </div>
  );
}
