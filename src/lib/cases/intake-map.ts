import type { Attachment, Case, CaseAsset } from "@prisma/client";
import { caseIntakeDefaultValues, type CaseFormValues } from "@/lib/validations/case";

function isoDateOnly(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

function isDraftPlaceholderJustification(s: string): boolean {
  return s.startsWith("Pending — draft") || s.startsWith("Draft —");
}

function assetsFromCase(assets: CaseAsset[] | undefined): CaseFormValues["assets"] {
  if (!assets?.length) return caseIntakeDefaultValues.assets ?? [];
  return assets.map((a) => ({
    platformName: a.platformName,
    serialNumbers: a.serialNumbers ?? undefined,
    eolBulletinLink: a.eolBulletinLink ?? undefined,
    hwLdosDate: isoDateOnly(a.hwLdosDate),
    softwareVersion: a.softwareVersion ?? undefined,
    quantity: a.quantity ?? undefined,
    buCost: Number(a.buCost) || 0,
    cxCost: Number(a.cxCost) || 0,
  }));
}

export function caseToIntakeFormValues(
  c: Case & {
    attachments?: Pick<Attachment, "fileName" | "mimeType" | "sizeBytes">[];
    assets?: CaseAsset[];
  }
): CaseFormValues {
  return {
    ...caseIntakeDefaultValues,
    draftCaseInternalId: c.id,
    requestType: c.requestType,
    priority: c.priority,
    customerName: c.customerName === "TBD" ? "" : c.customerName,
    dealId: !c.dealId || c.dealId === "TBD" ? "" : c.dealId,
    businessJustification: isDraftPlaceholderJustification(c.businessJustification)
      ? ""
      : c.businessJustification,
    extensionStartDate: isoDateOnly(c.extensionStartDate),
    extensionEndDate: isoDateOnly(c.extensionEndDate),
    migrationPlan: c.migrationPlan ?? undefined,
    essSupportSubtype: c.essSupportSubtype ?? undefined,
    migrationTimeline: c.migrationTimeline ?? undefined,
    targetReplacementProduct: c.targetReplacementProduct ?? undefined,
    hardwarePhysicalLocation: c.hardwarePhysicalLocation ?? undefined,
    softwareDeploymentType: c.softwareDeploymentType ?? undefined,
    softwareProductFamily: c.softwareProductFamily ?? undefined,
    softwareOnPremise: c.softwareOnPremise ?? undefined,
    softwarePerpetualLicense: c.softwarePerpetualLicense ?? undefined,
    softwareIsApplicationSoftware: c.softwareIsApplicationSoftware ?? undefined,
    softwareNotIosIosXr: c.softwareNotIosIosXr ?? undefined,
    environmentIsProduction: c.environmentIsProduction ?? undefined,
    essEligibilityAcknowledged: Boolean(c.essEligibilityAcknowledged),
    partnerName: c.partnerName ?? undefined,
    supportCoverageIndicator: c.supportCoverageIndicator ?? undefined,
    notes: c.notes ?? undefined,
    attachments:
      c.attachments?.map((a) => ({
        fileName: a.fileName,
        mimeType: a.mimeType ?? undefined,
        sizeBytes: a.sizeBytes ?? undefined,
      })) ?? [],
    assets: assetsFromCase(c.assets),
  };
}
