"use client";

import type { ReactNode } from "react";
import { Priority, RequestType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { saveCaseDraftAction, submitCaseIntakeAction } from "@/app/actions/cases";
import {
  caseIntakeDefaultValues,
  type CaseFormValues,
} from "@/lib/validations/case";
import { formatRequestType } from "@/lib/ui/format";

const STEPS = ["Request", "Essentials", "Details", "Attachments & review"] as const;

export function NewCaseForm({ initialDefaults }: { initialDefaults?: CaseFormValues }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<CaseFormValues>({
    defaultValues: initialDefaults ?? caseIntakeDefaultValues,
  });

  const requestType = useWatch({ control: form.control, name: "requestType" });
  const values = useWatch({ control: form.control });

  const draftId = form.watch("draftCaseInternalId");

  const summaryLines = useMemo(() => {
    const v = values;
    if (!v) return [];
    return [
      ["Request type", formatRequestType(v.requestType ?? RequestType.EoVSS)],
      ["Customer", v.customerName || "—"],
      ["Deal ID", v.dealId || "—"],
      ["Platform", v.platform || "—"],
      ["Software", v.softwareVersion || "—"],
      ["Extension", [v.extensionStartDate, v.extensionEndDate].filter(Boolean).join(" → ") || "—"],
      ["Justification", v.businessJustification ? `${v.businessJustification.slice(0, 120)}…` : "—"],
    ] as const;
  }, [values]);

  const onSaveDraft = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const payload = form.getValues();
      const result = await saveCaseDraftAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.setValue("draftCaseInternalId", result.id);
      setInfo("Draft saved.");
      router.replace(`/cases/new?draft=${result.id}`);
    } finally {
      setBusy(false);
    }
  };

  const onSubmitFinal = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const payload = form.getValues();
      const result = await submitCaseIntakeAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/cases/${result.id}`);
    } finally {
      setBusy(false);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="space-y-8">
      <input type="hidden" {...form.register("draftCaseInternalId")} />

      <nav aria-label="Intake progress" className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
              i === step
                ? "bg-slate-900 text-white ring-slate-900"
                : i < step
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>

      {draftId ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Editing a saved draft. Use <strong>Save draft</strong> anytime; <strong>Submit request</strong> validates
          the full intake and routes to CX Ops.
        </p>
      ) : null}

      {step === 0 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Request type</h2>
            <p className="mt-1 text-xs text-slate-500">Choose the EoX path. Later steps show fields relevant to that type.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.values(RequestType).map((rt) => (
                <label
                  key={rt}
                  className={`flex cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition hover:border-sky-300 ${
                    requestType === rt ? "border-sky-500 bg-sky-50/60 ring-1 ring-sky-400" : "border-slate-200 bg-white"
                  }`}
                >
                  <input type="radio" className="sr-only" {...form.register("requestType")} value={rt} />
                  <span className="text-sm font-semibold text-slate-900">{formatRequestType(rt)}</span>
                  <span className="mt-1 text-xs text-slate-600">
                    {rt === RequestType.EoVSS
                      ? "Version / software support — serials & HW LDOS common."
                      : rt === RequestType.EoSM
                        ? "Service migration — migration plan is key."
                        : "Extended support — partner & quantity required."}
                  </span>
                </label>
              ))}
            </div>
            {form.formState.errors.requestType?.message ? (
              <p className="mt-2 text-xs text-rose-700">{form.formState.errors.requestType.message}</p>
            ) : null}
          </div>
          <Field label="Priority" error={form.formState.errors.priority?.message}>
            <select
              className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("priority")}
            >
              {Object.values(Priority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Customer name" error={form.formState.errors.customerName?.message}>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("customerName")}
            />
          </Field>
          <Field label="Deal ID" error={form.formState.errors.dealId?.message}>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("dealId")}
            />
          </Field>
          <Field label="Platform" error={form.formState.errors.platform?.message}>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("platform")}
            />
          </Field>
          <Field label="Software version" error={form.formState.errors.softwareVersion?.message}>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("softwareVersion")}
            />
          </Field>
          <Field label="Extension start" error={form.formState.errors.extensionStartDate?.message}>
            <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("extensionStartDate")} />
          </Field>
          <Field label="Extension end" error={form.formState.errors.extensionEndDate?.message}>
            <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("extensionEndDate")} />
          </Field>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-6">
          <Field label="Business justification" error={form.formState.errors.businessJustification?.message}>
            <textarea
              rows={5}
              placeholder="Commercial context, risk, and why extension is needed."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("businessJustification")}
            />
          </Field>
          <Field label="Migration plan" error={form.formState.errors.migrationPlan?.message}>
            <textarea
              rows={4}
              placeholder={requestType === RequestType.EoSM ? "Required for EoSM (min. 10 characters on submit)." : "Optional unless EoSM."}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("migrationPlan")}
            />
          </Field>

          {requestType === RequestType.EoVSS ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">EoVSS — software & assets</p>
              <Field label="Serial numbers / asset identifiers" error={form.formState.errors.serialNumbers?.message}>
                <textarea
                  rows={3}
                  placeholder="One per line or comma-separated"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  {...form.register("serialNumbers")}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="EoL bulletin link" error={form.formState.errors.eolBulletinLink?.message}>
                  <input
                    type="url"
                    placeholder="https://…"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    {...form.register("eolBulletinLink")}
                  />
                </Field>
                <Field label="HW LDOS date" error={form.formState.errors.hwLdosDate?.message}>
                  <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("hwLdosDate")} />
                </Field>
              </div>
            </div>
          ) : null}

          {requestType === RequestType.EoSS ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">EoSS — partner & volume</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Partner name" error={form.formState.errors.partnerName?.message}>
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("partnerName")} />
                </Field>
                <Field
                  label="Quantity"
                  error={
                    typeof form.formState.errors.quantity?.message === "string"
                      ? form.formState.errors.quantity.message
                      : undefined
                  }
                >
                  <input type="number" min={1} step={1} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("quantity")} />
                </Field>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Support coverage indicator" error={form.formState.errors.supportCoverageIndicator?.message}>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...form.register("supportCoverageIndicator")}
              >
                <option value="">—</option>
                <option value="Essentials">Essentials</option>
                <option value="Advantage">Advantage</option>
                <option value="Limited">Limited</option>
                <option value="Unknown">Unknown</option>
              </select>
            </Field>
          </div>

          <Field label="Internal notes" error={form.formState.errors.notes?.message}>
            <textarea rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("notes")} />
          </Field>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Attachments (demo)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Files are not uploaded to a server. We store filename, size, and MIME type as metadata linked to the case
              for a realistic demo.
            </p>
            <input
              type="file"
              multiple
              className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-50"
              onChange={(e) => {
                const list = e.target.files;
                if (!list?.length) return;
                const next = Array.from(list).map((f) => ({
                  fileName: f.name,
                  mimeType: f.type || undefined,
                  sizeBytes: f.size,
                }));
                const merged = [...(form.getValues("attachments") ?? []), ...next].slice(0, 24);
                form.setValue("attachments", merged, { shouldValidate: false });
                e.target.value = "";
              }}
            />
            <ul className="mt-3 space-y-2 text-sm">
              {(form.watch("attachments") ?? []).map((a, idx) => (
                <li
                  key={`${a.fileName}-${idx}`}
                  className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-slate-800">{a.fileName}</div>
                    <div className="text-xs text-slate-500">
                      {a.mimeType ?? "unknown type"}
                      {a.sizeBytes != null ? ` · ${(a.sizeBytes / 1024).toFixed(1)} KB` : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-700 hover:underline"
                    onClick={() => {
                      const cur = form.getValues("attachments") ?? [];
                      form.setValue(
                        "attachments",
                        cur.filter((_, i) => i !== idx),
                        { shouldValidate: false }
                      );
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-inner">
            <h3 className="text-sm font-semibold text-slate-900">Review</h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {summaryLines.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs uppercase text-slate-500">{k}</dt>
                  <dd className="truncate text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-800">{info}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={step === 0 || busy}
            onClick={back}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={step >= STEPS.length - 1 || busy}
            onClick={next}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSaveDraft()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={busy || step < STEPS.length - 1}
            onClick={() => void onSubmitFinal()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
