import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType } from "@prisma/client";

export function taskTerminal(status: TaskStatus): boolean {
  return status === TaskStatus.Completed || status === TaskStatus.NotRequired;
}

/**
 * Recompute which tasks are runnable based on upstream completions.
 * Idempotent; safe to call after any task status change.
 *
 * Chains:
 * - EoVSS/EoSM: Intake → BU Review (per asset) → BU Pricing → Quote → VAP → Flag
 * - ESS/MSS: Intake → Eligibility Review (1–2 rows by subtype) → Quote → VAP → Flag
 */
export async function applyTaskActivationRules(caseId: string): Promise<void> {
  const maxPasses = 8;
  for (let pass = 0; pass < maxPasses; pass++) {
    const tasks = await prisma.task.findMany({ where: { caseId } });
    let progressed = false;

    const intake = tasks.find((t) => t.type === TaskType.IntakeValidation);
    if (intake && taskTerminal(intake.status)) {
      const r1 = await prisma.task.updateMany({
        where: { caseId, type: TaskType.BUReview, isRunnable: false },
        data: { isRunnable: true, activatedAt: new Date() },
      });
      const r2 = await prisma.task.updateMany({
        where: { caseId, type: TaskType.EligibilityReview, isRunnable: false },
        data: { isRunnable: true, activatedAt: new Date() },
      });
      if (r1.count > 0 || r2.count > 0) progressed = true;
    }

    const t2 = await prisma.task.findMany({ where: { caseId } });
    const buReviews = t2.filter((t) => t.type === TaskType.BUReview);
    if (buReviews.length === 0 || buReviews.every((t) => taskTerminal(t.status))) {
      const r = await prisma.task.updateMany({
        where: { caseId, type: TaskType.BUPricing, isRunnable: false },
        data: { isRunnable: true, activatedAt: new Date() },
      });
      if (r.count > 0) progressed = true;
    }

    const t3 = await prisma.task.findMany({ where: { caseId } });
    const buPricings = t3.filter((t) => t.type === TaskType.BUPricing);
    const eligibilities = t3.filter((t) => t.type === TaskType.EligibilityReview);
    const buPricingGate = buPricings.length === 0 || buPricings.every((t) => taskTerminal(t.status));
    const eligibilityGate = eligibilities.length === 0 || eligibilities.every((t) => taskTerminal(t.status));
    if (buPricingGate && eligibilityGate) {
      const r = await prisma.task.updateMany({
        where: { caseId, type: TaskType.QuoteTracking, isRunnable: false },
        data: { isRunnable: true, activatedAt: new Date() },
      });
      if (r.count > 0) progressed = true;
    }

    const t4 = await prisma.task.findMany({ where: { caseId } });
    const quote = t4.find((t) => t.type === TaskType.QuoteTracking);
    if (quote && taskTerminal(quote.status)) {
      const r = await prisma.task.updateMany({
        where: { caseId, type: TaskType.VAPTracking, isRunnable: false },
        data: { isRunnable: true, activatedAt: new Date() },
      });
      if (r.count > 0) progressed = true;
    }

    const t5 = await prisma.task.findMany({ where: { caseId } });
    const vap = t5.find((t) => t.type === TaskType.VAPTracking);
    if (vap && taskTerminal(vap.status)) {
      const r = await prisma.task.updateMany({
        where: { caseId, type: TaskType.FlagRemovalTracking, isRunnable: false },
        data: { isRunnable: true, activatedAt: new Date() },
      });
      if (r.count > 0) progressed = true;
    }

    if (!progressed) break;
  }
}
