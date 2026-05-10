import type { HomeKpiCounts } from "@/lib/home/home-kpis";

type Props = {
  counts: HomeKpiCounts;
};

const ITEMS: { key: keyof HomeKpiCounts; label: string }[] = [
  { key: "activeCases", label: "Active cases" },
  { key: "pendingYourInput", label: "Pending your input" },
  { key: "pendingInputFromOthers", label: "Pending input from others" },
  { key: "visibleCases", label: "Visible cases" },
];

export function HomeKpiCards({ counts }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ITEMS.map(({ key, label }) => (
        <div
          key={key}
          className="flex min-h-[140px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.02]"
        >
          <div className="flex flex-1 flex-col items-center justify-center py-2">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-slate-900">{counts[key]}</p>
          </div>
          <p className="mt-auto text-center text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}
