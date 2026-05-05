import type { ReactNode } from "react";

const TONE_CLASS: Record<"neutral" | "soft", string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  soft: "border-sky-200/80 bg-sky-50 text-sky-950",
};

export function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "soft";
  children: ReactNode;
}) {
  const cls = TONE_CLASS[tone] ?? TONE_CLASS.neutral;
  return (
    <span className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}
