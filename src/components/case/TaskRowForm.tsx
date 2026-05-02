"use client";

import { useState } from "react";
import { TaskStatus } from "@prisma/client";
import { formatTaskStatus } from "@/lib/ui/format";

type Props = {
  formId: string;
  defaultStatus: TaskStatus;
  defaultNotes: string;
  defaultBlockerReason: string | null;
  defaultNotRequiredReason: string | null;
  canEditTask: boolean;
  canManageAssignments: boolean;
  users: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  defaultOwnerId: string | null;
  defaultTeamId: string | null;
  defaultDue: string;
  defaultIsRequired: boolean;
  taskStatuses: TaskStatus[];
  ownershipCaption?: string;
  showTeamQueueHint?: boolean;
};

export function TaskRowForm({
  formId,
  taskStatuses,
  defaultStatus,
  defaultNotes,
  defaultBlockerReason,
  defaultNotRequiredReason,
  canEditTask,
  canManageAssignments,
  users,
  teams,
  defaultOwnerId,
  defaultTeamId,
  defaultDue,
  defaultIsRequired,
  ownershipCaption,
  showTeamQueueHint,
}: Props) {
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);

  return (
    <>
      <td className="px-3 py-2 text-slate-800">
        <select
          form={formId}
          name="status"
          defaultValue={defaultStatus}
          disabled={!canEditTask}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          {taskStatuses.map((s) => (
            <option key={s} value={s}>
              {formatTaskStatus(s)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-slate-600">
        <select
          form={formId}
          name="ownerId"
          defaultValue={defaultOwnerId ?? ""}
          disabled={!canManageAssignments}
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="">—</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {ownershipCaption ? <div className="mt-1 text-[10px] text-slate-500">{ownershipCaption}</div> : null}
        {showTeamQueueHint ? (
          <div className="text-[10px] text-emerald-700">Team queue: you can act without individual owner.</div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-slate-600">
        <select
          form={formId}
          name="assignedTeamId"
          defaultValue={defaultTeamId ?? ""}
          disabled={!canManageAssignments}
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="">—</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-slate-600">
        <input
          type="date"
          form={formId}
          name="dueDate"
          defaultValue={defaultDue}
          disabled={!canManageAssignments}
          className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
      </td>
      <td className="px-3 py-2 text-slate-600">
        <select
          form={formId}
          name="isRequired"
          defaultValue={String(defaultIsRequired)}
          disabled={!canEditTask}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </td>
      <td className="px-3 py-2 text-slate-600">
        <div className="space-y-1">
          <textarea
            form={formId}
            name="notes"
            rows={2}
            defaultValue={defaultNotes}
            disabled={!canEditTask}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          {status === TaskStatus.Blocked ? (
            <textarea
              form={formId}
              name="blockerReason"
              rows={2}
              placeholder="Blocker reason (required)"
              defaultValue={defaultBlockerReason ?? ""}
              disabled={!canEditTask}
              className="w-full rounded-md border border-rose-200 bg-rose-50/50 px-2 py-1 text-xs"
            />
          ) : (
            <input type="hidden" name="blockerReason" value="" form={formId} />
          )}
          {status === TaskStatus.NotRequired ? (
            <textarea
              form={formId}
              name="notRequiredReason"
              rows={2}
              placeholder="Not required reason (required)"
              defaultValue={defaultNotRequiredReason ?? ""}
              disabled={!canEditTask}
              className="w-full rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1 text-xs"
            />
          ) : (
            <input type="hidden" name="notRequiredReason" value="" form={formId} />
          )}
        </div>
      </td>
    </>
  );
}
