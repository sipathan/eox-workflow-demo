"use client";

import { useFormStatus } from "react-dom";
import { useMemo, useState } from "react";
import { ExternalReferenceIntegrationState } from "@prisma/client";
import type { SalesforceIbCardState } from "@/lib/integrations/salesforce-ib";
import { createSalesforceIbCaseAction } from "@/app/actions/case-workspace";
import { formatIntegrationStateLabel } from "@/lib/external-references/integration-reference";

export type SalesforceIbPrimaryRefSnapshot = {
  integrationState: string | null;
  externalStatus: string | null;
  referenceId: string | null;
  externalKey: string | null;
  externalRecordUrl: string | null;
  externalSystemName: string | null;
  lastAttemptAtIso: string | null;
  lastErrorMessage: string | null;
  rowCreatedAtIso: string | null;
};

const CARD_STATE_LABEL: Record<SalesforceIbCardState, string> = {
  not_created: "Not Created",
  ready_to_create: "Ready to Create",
  created: "Created",
  failed: "Failed",
};

const CARD_STATE_STYLES: Record<SalesforceIbCardState, string> = {
  not_created: "border-slate-200 bg-slate-50 text-slate-800",
  ready_to_create: "border-sky-200 bg-sky-50 text-sky-950",
  created: "border-emerald-200 bg-emerald-50 text-emerald-950",
  failed: "border-rose-200 bg-rose-50 text-rose-950",
};

function IbSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[2.25rem] min-w-[8.5rem] items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden
          />
          Working…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Detail({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function SalesforceIbCaseSection(props: {
  caseDbId: string;
  cardState: SalesforceIbCardState;
  canTriggerAction: boolean;
  showCreateOrRetry: boolean;
  isRetry: boolean;
  demoMode: boolean;
  payloadPreview: Record<string, unknown> | null;
  eligibilityBlockedReason: string | null;
  eligibleButNoPermission: boolean;
  viewerStatusNote: string | null;
  primaryRef: SalesforceIbPrimaryRefSnapshot | null;
}) {
  const [payloadOpen, setPayloadOpen] = useState(false);

  const payloadJson = useMemo(() => {
    if (!props.payloadPreview) return "";
    try {
      return JSON.stringify(props.payloadPreview, null, 2);
    } catch {
      return "";
    }
  }, [props.payloadPreview]);

  const showPayloadPanel = props.demoMode && props.payloadPreview && payloadJson.length > 0;

  return (
    <section
      className="rounded-xl border border-slate-200 border-l-[3px] border-l-sky-600 bg-white p-4 shadow-sm"
      aria-labelledby="salesforce-ib-case-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="salesforce-ib-case-heading" className="text-sm font-semibold text-slate-900">
            Salesforce IB Case
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600">
            Issue Backlog case in Salesforce, driven by the integration provider configured for this environment.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${CARD_STATE_STYLES[props.cardState]}`}
        >
          {CARD_STATE_LABEL[props.cardState]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <Detail label="Integration status">
          {props.primaryRef?.integrationState != null
            ? formatIntegrationStateLabel(
                props.primaryRef.integrationState as ExternalReferenceIntegrationState
              )
            : "—"}
        </Detail>
        <Detail label="External status (Salesforce)">{props.primaryRef?.externalStatus?.trim() || "—"}</Detail>
        <Detail label="Salesforce case number">{props.primaryRef?.externalKey?.trim() || "—"}</Detail>
        <Detail label="Salesforce record ID">
          {props.primaryRef?.referenceId?.trim() ? (
            <span className="break-all font-mono text-xs">{props.primaryRef.referenceId}</span>
          ) : (
            "—"
          )}
        </Detail>
        <Detail label="External system">{props.primaryRef?.externalSystemName?.trim() || "—"}</Detail>
        <Detail label="Record linked at">
          {props.primaryRef?.rowCreatedAtIso
            ? new Date(props.primaryRef.rowCreatedAtIso).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
        </Detail>
        <Detail label="Last integration attempt">
          {props.primaryRef?.lastAttemptAtIso
            ? new Date(props.primaryRef.lastAttemptAtIso).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
        </Detail>
        <Detail label="Record link" fullWidth>
          {props.primaryRef?.externalRecordUrl?.trim() ? (
            <a
              href={props.primaryRef.externalRecordUrl}
              className="break-all text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {props.primaryRef.externalRecordUrl}
            </a>
          ) : props.cardState === "created" ? (
            <span className="text-slate-500">No URL on file</span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Detail>
        {props.cardState === "failed" && props.primaryRef?.lastErrorMessage?.trim() ? (
          <Detail label="Last error" fullWidth>
            <span className="whitespace-pre-wrap text-sm text-rose-800">{props.primaryRef.lastErrorMessage}</span>
          </Detail>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        {props.showCreateOrRetry ? (
          <form action={createSalesforceIbCaseAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="caseId" value={props.caseDbId} />
            <IbSubmitButton>
              {props.isRetry ? "Retry creation" : "Create IB case"}
            </IbSubmitButton>
            <span className="text-xs text-slate-500">Runs server-side through the Salesforce IB provider.</span>
          </form>
        ) : props.canTriggerAction && props.eligibilityBlockedReason ? (
          <p className="text-xs text-amber-900">
            <span className="font-medium">Action unavailable:</span> {props.eligibilityBlockedReason}
          </p>
        ) : null}

        {!props.canTriggerAction && props.eligibleButNoPermission ? (
          <p className="text-xs text-slate-600">
            Only <strong>CX Operations</strong> or <strong>Platform Admin</strong> can create or retry Salesforce IB
            cases.
          </p>
        ) : null}

        {!props.canTriggerAction && props.viewerStatusNote ? (
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">Status:</span> {props.viewerStatusNote}
          </p>
        ) : null}
      </div>

      {showPayloadPanel ? (
        <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setPayloadOpen((o) => !o)}
            className="text-xs font-medium text-sky-800 hover:text-sky-950"
          >
            {payloadOpen ? "Hide" : "View"} provider payload (demo)
          </button>
          {payloadOpen ? (
            <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800">
              {payloadJson}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
