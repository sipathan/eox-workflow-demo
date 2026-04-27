import type { Attachment, Case } from "@prisma/client";
import { caseIntakeDefaultValues, type CaseFormValues } from "@/lib/validations/case";

function isoDateOnly(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

function isDraftPlaceholderJustification(s: string): boolean {
  return s.startsWith("Pending — draft") || s.startsWith("Draft —");
}

export function caseToIntakeFormValues(
  c: Case & { attachments?: Pick<Attachment, "fileName" | "mimeType" | "sizeBytes">[] }
): CaseFormValues {
  return {
    ...caseIntakeDefaultValues,
    draftCaseInternalId: c.id,
    requestType: c.requestType,
    priority: c.priority,
    customerName: c.customerName === "TBD" ? "" : c.customerName,
    dealId: c.dealId === "TBD" ? "" : c.dealId,
    platform: c.platform === "TBD" ? "" : c.platform,
    softwareVersion: c.softwareVersion === "TBD" ? "" : c.softwareVersion,
    businessJustification: isDraftPlaceholderJustification(c.businessJustification)
      ? ""
      : c.businessJustification,
    extensionStartDate: isoDateOnly(c.extensionStartDate),
    extensionEndDate: isoDateOnly(c.extensionEndDate),
    migrationPlan: c.migrationPlan ?? undefined,
    partnerName: c.partnerName ?? undefined,
    quantity: c.quantity ?? undefined,
    eolBulletinLink: c.eolBulletinLink ?? undefined,
    serialNumbers: c.serialNumbers ?? undefined,
    supportCoverageIndicator: c.supportCoverageIndicator ?? undefined,
    hwLdosDate: isoDateOnly(c.hwLdosDate),
    notes: c.notes ?? undefined,
    attachments:
      c.attachments?.map((a) => ({
        fileName: a.fileName,
        mimeType: a.mimeType ?? undefined,
        sizeBytes: a.sizeBytes ?? undefined,
      })) ?? [],
  };
}
