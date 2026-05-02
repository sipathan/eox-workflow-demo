"use client";

import type { ReactNode } from "react";
import { EssMssSupportSubtype, Priority, RequestType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { saveCaseDraftAction, submitCaseIntakeAction } from "@/app/actions/cases";
import {
  caseIntakeDefaultValues,
  type CaseFormValues,
} from "@/lib/validations/case";
import { IntakeAssetFinancialFields } from "@/components/case/IntakeAssetFinancialFields";
import { formatEssMssSupportSubtype, formatRequestType, REQUEST_TYPE_INTAKE_HINT } from "@/lib/ui/format";

const STEPS = ["Request", "Essentials", "Details & platforms", "Attachments & review"] as const;

export function NewCaseForm({ initialDefaults }: { initialDefaults?: CaseFormValues }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<CaseFormValues>({
    defaultValues: initialDefaults ?? caseIntakeDefaultValues,
  });

  const { fields: assetFields, append: appendAsset, remove: removeAsset } = useFieldArray({
    control: form.control,
    name: "assets",
  });

  const requestType = useWatch({ control: form.control, name: "requestType" });
  const essSubtype = useWatch({ control: form.control, name: "essSupportSubtype" });
  const values = useWatch({ control: form.control });

  const draftId = form.watch("draftCaseInternalId");

  const summaryLines = useMemo(() => {
    const v = values;
    if (!v) return [];
    const assetSummary =
      (v.assets?.length ?? 0) === 0
        ? "—"
        : (v.assets ?? [])
            .map((a, i) => {
              const name = a.platformName?.trim() || "(unnamed)";
              const sn = a.serialNumbers?.trim();
              const snPreview = sn
                ? sn
                    .split(/\n|,/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", ") + (sn.length > 60 ? "…" : "")
                : null;
              const qRaw = a.quantity;
              const qNum = typeof qRaw === "number" ? qRaw : Number(String(qRaw ?? "").trim());
              const qtyLine =
                String(qRaw ?? "").trim() !== "" && Number.isFinite(qNum) && qNum >= 0
                  ? `\n   Quantity: ${qNum}`
                  : "";
              return `${i + 1}. ${name}${snPreview ? `\n   Serials: ${snPreview}` : ""}${qtyLine}`;
            })
            .join("\n\n");
    const partnerLine = v.partnerName?.trim();
    const lines: [string, string][] = [
      ["Service", formatRequestType(v.requestType ?? RequestType.EoVSS)],
      ["Customer", v.customerName || "—"],
      ["Deal ID", v.dealId?.trim() ? v.dealId : "Not set (CX / partner admin can add later)"],
    ];
    if (partnerLine) lines.push(["Partner (optional)", partnerLine]);
    if (v.requestType === RequestType.ESS_MSS) {
      lines.push(["Support subtype", v.essSupportSubtype ? formatEssMssSupportSubtype(v.essSupportSubtype) : "—"]);
      if (v.migrationPlan?.trim()) {
        const mp = v.migrationPlan.trim();
        lines.push(["Migration plan", mp.length > 220 ? `${mp.slice(0, 220)}…` : mp]);
      }
      if (v.migrationTimeline?.trim()) lines.push(["Migration timeline", v.migrationTimeline.trim()]);
      if (v.targetReplacementProduct?.trim()) lines.push(["Target replacement", v.targetReplacementProduct.trim()]);
      if (v.hardwarePhysicalLocation?.trim()) lines.push(["Hardware location", v.hardwarePhysicalLocation.trim()]);
      if (v.softwareDeploymentType?.trim()) lines.push(["Software deployment", v.softwareDeploymentType.trim()]);
      if (v.softwareProductFamily?.trim()) lines.push(["Software product family", v.softwareProductFamily.trim()]);
    }
    lines.push(
      ["Platforms", assetSummary],
      ["Extension", [v.extensionStartDate, v.extensionEndDate].filter(Boolean).join(" → ") || "—"],
      ["Justification", v.businessJustification ? `${v.businessJustification.slice(0, 120)}…` : "—"],
    );
    return lines;
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

  const emptyAssetRow = () =>
    ({
      platformName: "",
      serialNumbers: undefined,
      eolBulletinLink: undefined,
      hwLdosDate: undefined,
      softwareVersion: undefined,
      quantity: undefined,
      buCost: 0,
      cxCost: 0,
    }) satisfies CaseFormValues["assets"][number];

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
          the full intake and routes to CX Ops. Only platform cards with a <strong>platform name</strong> are stored
          on draft save.
        </p>
      ) : null}

      {step === 0 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Service</h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose <strong className="font-medium text-slate-700">EoVSS</strong>,{" "}
              <strong className="font-medium text-slate-700">EoSM</strong>, or{" "}
              <strong className="font-medium text-slate-700">ESS/MSS</strong>. Later steps add the{" "}
              <strong className="font-medium text-slate-700">ESS/MSS</strong> intake block only when that service is
              selected.
            </p>
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
                  <span className="mt-1 text-xs text-slate-600">{REQUEST_TYPE_INTAKE_HINT[rt]}</span>
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
        <section className="grid gap-6 md:grid-cols-2">
          <Field label="Customer name" error={form.formState.errors.customerName?.message}>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("customerName")}
            />
          </Field>
          <Field
            label="Deal ID"
            hint="Optional. If you do not have a Deal ID yet, leave this blank—CX Operations or your partner administrator can add or update it on the case after submission."
            error={form.formState.errors.dealId?.message}
          >
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="e.g. DEAL-12345 (optional)"
              {...form.register("dealId")}
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
        <section className="space-y-8">
          <Field label="Business justification" error={form.formState.errors.businessJustification?.message}>
            <textarea
              rows={5}
              placeholder="Commercial context, risk, and why extension is needed."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...form.register("businessJustification")}
            />
          </Field>
          {requestType === RequestType.ESS_MSS ? (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 ring-1 ring-emerald-900/10">
              <div>
                <h3 className="text-sm font-semibold text-emerald-950">ESS/MSS</h3>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900/85">
                  <strong className="font-medium text-emerald-950">ESS/MSS</strong> uses ESS-oriented intake fields
                  today; MSS-specific workflow is not enabled yet. The fields below apply only to this service;
                  platforms and serials stay on each card in{" "}
                  <strong className="font-medium">Platforms &amp; equipment</strong>.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-100/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Support subtype</p>
                <p className="mt-1 text-xs text-slate-500">Hardware, Software, or both.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {Object.values(EssMssSupportSubtype).map((s) => (
                    <label
                      key={s}
                      className={`flex cursor-pointer flex-col rounded-lg border px-3 py-3 text-left transition ${
                        essSubtype === s
                          ? "border-emerald-500 bg-emerald-50/80 ring-1 ring-emerald-400"
                          : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <input type="radio" className="sr-only" {...form.register("essSupportSubtype")} value={s} />
                      <span className="text-sm font-medium text-slate-900">{formatEssMssSupportSubtype(s)}</span>
                    </label>
                  ))}
                </div>
                {form.formState.errors.essSupportSubtype?.message ? (
                  <p className="mt-2 text-xs text-rose-700">{form.formState.errors.essSupportSubtype.message}</p>
                ) : null}
              </div>

              <div className="rounded-lg border border-emerald-100/80 bg-white p-4 shadow-sm space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Migration plan</p>
                <Field
                  label="Details (required on submit)"
                  hint="Scope, cutover, dependencies, and rollback — minimum length enforced when you submit."
                  error={form.formState.errors.migrationPlan?.message}
                >
                  <textarea
                    rows={5}
                    placeholder="Describe migration approach, milestones, and customer impact…"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    {...form.register("migrationPlan")}
                  />
                </Field>
                <Field label="Timeline (optional)" error={form.formState.errors.migrationTimeline?.message}>
                  <textarea
                    rows={2}
                    placeholder="Key dates or phased rollout window…"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    {...form.register("migrationTimeline")}
                  />
                </Field>
                <Field
                  label="Target replacement product or service (optional)"
                  error={form.formState.errors.targetReplacementProduct?.message}
                >
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. SKU or service name if known"
                    {...form.register("targetReplacementProduct")}
                  />
                </Field>
              </div>

              {(essSubtype === EssMssSupportSubtype.HARDWARE ||
                essSubtype === EssMssSupportSubtype.HARDWARE_AND_SOFTWARE) && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hardware location</p>
                  <p className="text-xs text-slate-500">
                    Required on submit when hardware is in scope. Add serial numbers and platform lines in{" "}
                    <strong className="font-medium text-slate-700">Platforms &amp; equipment</strong> below.
                  </p>
                  <Field
                    label="Physical location (site / datacenter)"
                    error={form.formState.errors.hardwarePhysicalLocation?.message}
                  >
                    <textarea
                      rows={2}
                      placeholder="Address or site reference used for hardware support assessment…"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      {...form.register("hardwarePhysicalLocation")}
                    />
                  </Field>
                </div>
              )}

              {(essSubtype === EssMssSupportSubtype.SOFTWARE ||
                essSubtype === EssMssSupportSubtype.HARDWARE_AND_SOFTWARE) && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Software &amp; eligibility</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Deployment and product context; checkboxes document intent for review (not IOS/IOS‑XR application
                      stack).
                    </p>
                  </div>
                  <Field label="Deployment type" error={form.formState.errors.softwareDeploymentType?.message}>
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. on‑prem cluster, HA pair, virtualized app tier…"
                      {...form.register("softwareDeploymentType")}
                    />
                  </Field>
                  <Field
                    label="Product family / application type"
                    error={form.formState.errors.softwareProductFamily?.message}
                  >
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Application or product family (not IOS/IOS‑XR)…"
                      {...form.register("softwareProductFamily")}
                    />
                  </Field>
                  <Field label="Environment" error={form.formState.errors.environmentIsProduction?.message}>
                    <select
                      className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                      {...form.register("environmentIsProduction", {
                        setValueAs: (v: string) => (v === "" ? undefined : v === "true"),
                      })}
                    >
                      <option value="">Select…</option>
                      <option value="true">Production</option>
                      <option value="false">Lab / non-production (review)</option>
                    </select>
                  </Field>
                  <fieldset className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-3">
                    <legend className="px-1 text-xs font-medium text-slate-700">Software declarations</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["softwareOnPremise", "On‑premise deployment"],
                          ["softwarePerpetualLicense", "Perpetual license"],
                          ["softwareIsApplicationSoftware", "Application software (not network OS)"],
                          ["softwareNotIosIosXr", "Not IOS / IOS‑XR"],
                        ] as const
                      ).map(([name, label]) => (
                        <label key={name} className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
                          <input type="checkbox" className="mt-0.5 rounded border-slate-300" {...form.register(name)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
                    <input type="checkbox" className="mt-0.5 rounded border-slate-300" {...form.register("essEligibilityAcknowledged")} />
                    <span>
                      I confirm CX may need an eligibility review when any declaration is unchecked or the environment is
                      lab / non‑production.
                    </span>
                  </label>
                </div>
              )}
            </div>
          ) : (
            <Field
              label="Supporting details (optional)"
              hint="Optional context for reviewers (timelines, coverage needs, or related notes). Not required for EoVSS / EoSM."
              error={form.formState.errors.migrationPlan?.message}
            >
              <textarea
                rows={4}
                placeholder="Optional — e.g. key dates, scope notes, or references useful for CX/BU review."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                {...form.register("migrationPlan")}
              />
            </Field>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner (optional)</p>
            <p className="text-xs text-slate-600">
              Partner name is never required. Add it only if it helps your team review this request. Quantity is set per
              platform in <strong className="font-medium text-slate-800">Platforms &amp; equipment</strong> below.
            </p>
            <Field label="Partner name (optional)" error={form.formState.errors.partnerName?.message}>
              <input
                className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional"
                aria-required="false"
                autoComplete="organization"
                {...form.register("partnerName")}
              />
            </Field>
          </div>

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

          <div className="border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-xl">
                <h3 className="text-sm font-semibold text-slate-900">Platforms & equipment</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Use a separate card for each platform or SKU. Serial numbers and lifecycle fields belong to that card
                  only. On submit, BU Review and BU Pricing tasks are created <strong>per platform</strong>; Intake
                  Validation opens immediately.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                onClick={() => appendAsset(emptyAssetRow())}
              >
                Add platform
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {assetFields.map((field, idx) => (
                <article
                  key={field.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Platform {idx + 1}
                      {assetFields.length > 1 ? <span className="font-normal text-slate-400"> of {assetFields.length}</span> : null}
                    </h4>
                    {assetFields.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-700 hover:underline"
                        onClick={() => removeAsset(idx)}
                      >
                        Remove platform
                      </button>
                    ) : null}
                  </header>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field
                      label="Platform name"
                      hint="Required when you submit (and to save this card on draft)."
                      error={form.formState.errors.assets?.[idx]?.platformName?.message}
                    >
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="e.g. ASR 9000, Catalyst 9300"
                        {...form.register(`assets.${idx}.platformName`)}
                      />
                    </Field>
                    <Field
                      label="Software version"
                      hint="Optional unless you need it for clarity."
                      error={form.formState.errors.assets?.[idx]?.softwareVersion?.message}
                    >
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="e.g. 17.9.4a"
                        {...form.register(`assets.${idx}.softwareVersion`)}
                      />
                    </Field>
                    <Field
                      label="Quantity (optional)"
                      hint="Units or count for this platform line only."
                      error={
                        typeof form.formState.errors.assets?.[idx]?.quantity?.message === "string"
                          ? form.formState.errors.assets[idx]?.quantity?.message
                          : undefined
                      }
                    >
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Optional"
                        aria-required="false"
                        {...form.register(`assets.${idx}.quantity`)}
                      />
                    </Field>
                  </div>

                  <IntakeAssetFinancialFields
                    control={form.control}
                    register={form.register}
                    index={idx}
                    buError={form.formState.errors.assets?.[idx]?.buCost?.message}
                    cxError={form.formState.errors.assets?.[idx]?.cxCost?.message}
                    setCxValue={(cx) =>
                      form.setValue(`assets.${idx}.cxCost`, cx, { shouldValidate: true, shouldDirty: true })
                    }
                  />

                  <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/90 p-4">
                    <p className="text-xs font-semibold text-slate-800">Serial numbers &amp; lifecycle (this platform)</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {requestType === RequestType.EoVSS
                        ? "Serial numbers or asset IDs are required for each platform when you submit an EoVSS request."
                        : requestType === RequestType.ESS_MSS
                          ? "ESS/MSS hardware scope: include serials on at least one platform when you submit. Software scope: serials optional but useful."
                          : "Optional for EoSM; include if it helps CX and BU review this line item."}
                    </p>
                    <div className="mt-3 space-y-3">
                      <Field
                        label="Serial numbers / asset identifiers"
                        error={form.formState.errors.assets?.[idx]?.serialNumbers?.message}
                      >
                        <textarea
                          rows={3}
                          placeholder="One per line or comma-separated — scoped to this platform only"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          {...form.register(`assets.${idx}.serialNumbers`)}
                        />
                      </Field>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="EoL bulletin link" error={form.formState.errors.assets?.[idx]?.eolBulletinLink?.message}>
                          <input
                            type="url"
                            placeholder="https://…"
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            {...form.register(`assets.${idx}.eolBulletinLink`)}
                          />
                        </Field>
                        <Field label="Hardware LDOS date" error={form.formState.errors.assets?.[idx]?.hwLdosDate?.message}>
                          <input type="date" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" {...form.register(`assets.${idx}.hwLdosDate`)} />
                        </Field>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
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

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-inner">
            <h3 className="text-sm font-semibold text-slate-900">Review</h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {summaryLines.map(([k, v]) => (
                <div key={k} className={`min-w-0 ${k === "Migration plan" || k === "Platforms" ? "sm:col-span-2" : ""}`}>
                  <dt className="text-xs uppercase text-slate-500">{k}</dt>
                  <dd
                    className={
                      k === "Platforms" || k === "Migration plan"
                        ? "whitespace-pre-wrap break-words text-slate-800"
                        : "truncate text-slate-800"
                    }
                  >
                    {v}
                  </dd>
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
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {hint ? <p className="mb-2 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
