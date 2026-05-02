"use client";

import { QuoteBookingStatus } from "@prisma/client";
import { useState } from "react";
import { updateCaseQuoteBookingAction } from "@/app/actions/case-workspace";
import { formatQuoteBookingStatus } from "@/lib/ui/format";

const STATUSES: QuoteBookingStatus[] = [
  QuoteBookingStatus.OPEN,
  QuoteBookingStatus.BOOKED,
  QuoteBookingStatus.NOT_BOOKED,
  QuoteBookingStatus.PASSED_OVER,
];

function needsNotBookedReason(status: QuoteBookingStatus): boolean {
  return status === QuoteBookingStatus.NOT_BOOKED || status === QuoteBookingStatus.PASSED_OVER;
}

type Props = {
  caseId: string;
  defaultStatus: QuoteBookingStatus;
  defaultReason: string | null;
};

/** Editable booking outcome; reason field only for NOT_BOOKED / PASSED_OVER. */
export function BookingOutcomeForm({ caseId, defaultStatus, defaultReason }: Props) {
  const [status, setStatus] = useState<QuoteBookingStatus>(defaultStatus);
  const [reason, setReason] = useState(() => defaultReason?.trim() ?? "");
  const showReason = needsNotBookedReason(status);

  return (
    <form action={updateCaseQuoteBookingAction} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="block text-xs font-medium text-slate-700">
        Quote booking status
        <select
          name="quoteBookingStatus"
          value={status}
          onChange={(e) => setStatus(e.target.value as QuoteBookingStatus)}
          className="mt-1 block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatQuoteBookingStatus(s)}
            </option>
          ))}
        </select>
      </label>

      {showReason ? (
        <label className="block text-xs font-medium text-slate-700">
          Not booked reason
          <textarea
            name="notBookedReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Explain why the opportunity was not booked or was passed over…"
            className="mt-1 block w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </label>
      ) : (
        <input type="hidden" name="notBookedReason" value="" />
      )}

      {!showReason ? (
        <p className="text-xs text-slate-500">
          A reason is only collected when status is <strong>Not booked</strong> or <strong>Passed over</strong>. Saving
          as Open or Booked clears any stored reason on the server.
        </p>
      ) : (
        <p className="text-xs text-slate-500">A short, specific reason helps leadership reporting and pipeline reviews.</p>
      )}

      <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800">
        Save booking outcome
      </button>
    </form>
  );
}
