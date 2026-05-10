"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { isAllowedDemoLoginEmail } from "@/lib/auth/demo-accounts";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env/demo-mode";
import { prisma } from "@/lib/prisma";

export async function demoLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!isAllowedDemoLoginEmail(email)) {
    redirect("/?login=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, passwordHash: true },
  });
  if (!user?.isActive) redirect("/?login=invalid");

  const passwordOk = password.length > 0 && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordOk) redirect("/?login=invalid");

  const ok = await setSessionCookie(user.id);
  if (!ok) redirect("/?login=config");

  redirect("/");
}

export async function demoLogoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

/**
 * Instant persona switch for live demos. **Only when `DEMO_MODE=true`.**
 * Does not verify password — intended for pilot hosts; omit or disable `DEMO_MODE` everywhere else.
 */
export async function demoSwitchPersonaAction(formData: FormData): Promise<void> {
  if (!isDemoMode()) {
    redirect("/");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isAllowedDemoLoginEmail(email)) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) {
    redirect("/");
  }

  const ok = await setSessionCookie(user.id);
  if (!ok) {
    redirect("/?login=config");
  }

  redirect("/");
}
