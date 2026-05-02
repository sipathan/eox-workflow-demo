import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { RoleKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: RoleKey[];
  teams: { id: string }[];
};

const COOKIE_NAME = "eox_session";

function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) return null;
  return s;
}

/** Signed payload `1:<userId>:<hex-hmac>`. Demo-only transport; keep SESSION_SECRET strong. */
export function signSessionToken(userId: string): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = `1:${userId}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const lastColon = token.lastIndexOf(":");
  if (lastColon <= 0) return null;
  const payload = token.slice(0, lastColon);
  const sig = token.slice(lastColon + 1);
  if (!payload.startsWith("1:")) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const userId = payload.slice(2);
  return userId || null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = verifySessionToken(jar.get(COOKIE_NAME)?.value);
  if (!userId) return null;

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    include: {
      roles: { include: { role: true } },
      teams: true,
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map((ur) => ur.role.key),
    teams: user.teams.map((ut) => ({ id: ut.teamId })),
  };
}

export async function setSessionCookie(userId: string): Promise<boolean> {
  const token = signSessionToken(userId);
  if (!token) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return true;
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
