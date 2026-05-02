import { CiscoBrandLogo } from "@/components/branding/CiscoBrandLogo";

/** Compact enterprise hero for signed-in Home — avoids oversized marketing-style blocks. */
export function SignedInHomeBrandBanner() {
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="home-brand-title"
    >
      <div className="h-1 bg-gradient-to-r from-sky-900 via-sky-600 to-sky-700" aria-hidden />
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="shrink-0">
          <CiscoBrandLogo className="h-8 w-auto max-w-[5.5rem] object-contain object-left" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h2
              id="home-brand-title"
              className="text-base font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg"
            >
              EoX Workflow Management Platform
            </h2>
            <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-950">
              Internal demo
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Digitizing EoVSS / EoSM / ESS/MSS Request Management
          </p>
        </div>
      </div>
    </section>
  );
}
