"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";

type UserOpt = { id: string; name: string };

/**
 * Multi-assignee control: removable chips + “Add” dropdown.
 * Submits selected ids as repeated `assigneeUserId` fields on the given `formId`.
 * Parent should set `key` when server-provided `defaultSelectedIds` change so local state resets.
 */
export function TaskAssigneesEditor({
  formId,
  users,
  defaultSelectedIds,
  disabled,
  compact,
  showSharedTaskHint = true,
}: {
  formId: string;
  users: readonly UserOpt[];
  defaultSelectedIds: readonly string[];
  disabled: boolean;
  /** Tighter layout for table cells */
  compact?: boolean;
  /** Explain shared task + primary owner (off in dense table rows). */
  showSharedTaskHint?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [...new Set(defaultSelectedIds)]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const idToName = useMemo(() => new Map(users.map((u) => [u.id, u.name] as const)), [users]);

  const addOptions = users.filter((u) => !selectedSet.has(u.id));

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="assigneeUserId" value={id} form={formId} />
      ))}
      <div className="flex flex-wrap gap-1">
        {selectedIds.length === 0 ? (
          <span className="text-xs text-slate-400">No individuals — team queue only</span>
        ) : (
          selectedIds.map((id) => {
            const name = idToName.get(id) ?? id.slice(-6);
            return (
              <span key={id} className="inline-flex min-w-0 items-center gap-0.5">
                <Badge tone="soft">
                  <span className="max-w-[9rem] truncate" title={name}>
                    {name}
                  </span>
                </Badge>
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    className="rounded px-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setSelectedIds((prev) => prev.filter((x) => x !== id))}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            );
          })
        )}
      </div>
      {!disabled ? (
        <div className="flex flex-col gap-0.5">
          <label className="sr-only" htmlFor={`${formId}-add-assignee`}>
            Add assignee
          </label>
          <select
            id={`${formId}-add-assignee`}
            value=""
            className="max-w-[14rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setSelectedIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
              e.target.value = "";
            }}
          >
            <option value="">+ Add assignee…</option>
            {addOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {showSharedTaskHint ? (
            <p className="text-[10px] leading-snug text-slate-500">
              Shared task: status and notes apply to all assignees. First listed is the primary owner for routing.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
