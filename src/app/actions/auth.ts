"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";

const DEMO_EMAILS = new Set([
  "sales.demo@local",
  "cx.demo@local",
  "bu.demo@local",
  "finance.demo@local",
  "leader.demo@local",
  "admin.demo@local",
]);

export async function demoLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!DEMO_EMAILS.has(email)) {
    redirect("/?login=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) redirect("/?login=invalid");

  const ok = await setSessionCookie(user.id);
  if (!ok) redirect("/?login=config");

  redirect("/cases");
}

export async function demoLogoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}
