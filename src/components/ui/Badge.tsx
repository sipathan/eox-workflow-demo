import type { ReactNode } from "react";

export function Badge({
  tone,
  children,
}: {
  tone: "neutral";
  children: ReactNode;
}) {
  const cls =
    tone === "neutral"
      ? "border-slate-200 bg-slate-50 text-slate-800"
      : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}
