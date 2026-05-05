import { Badge } from "@/components/ui/Badge";

/** Compact read-only assignee list for workflow tables. */
export function TaskAssigneeChips({
  assignees,
  emptyLabel = "Unassigned",
}: {
  assignees: readonly { id: string; name: string }[];
  emptyLabel?: string;
}) {
  if (assignees.length === 0) {
    return <span className="text-xs text-slate-400">{emptyLabel}</span>;
  }
  return (
    <ul className="flex max-w-[16rem] flex-wrap gap-1" aria-label="Task assignees">
      {assignees.map((a) => (
        <li key={a.id} className="min-w-0">
          <Badge tone="soft">
            <span className="block max-w-[11rem] truncate" title={a.name}>
              {a.name}
            </span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
