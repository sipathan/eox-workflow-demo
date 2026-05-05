"use client";

import { useRef } from "react";
import { demoSwitchPersonaAction } from "@/app/actions/auth";
import { DEMO_LOGIN_ACCOUNTS } from "@/lib/auth/demo-accounts";

type Props = {
  currentEmail: string;
};

/** Client boundary: auto-submit on change. Server action enforces `DEMO_MODE`. */
export function DemoPersonaSwitcher({ currentEmail }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={demoSwitchPersonaAction} className="flex min-w-0 items-center gap-2">
      <label htmlFor="demo-persona-select" className="sr-only">
        Switch demo persona
      </label>
      <select
        id="demo-persona-select"
        name="email"
        defaultValue={currentEmail.toLowerCase()}
        onChange={() => formRef.current?.requestSubmit()}
        className="max-w-[min(100%,14rem)] truncate rounded-md border border-amber-300/80 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-950 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
        title="Demo only: switch seeded user without re-entering password"
      >
        {DEMO_LOGIN_ACCOUNTS.map((a) => (
          <option key={a.email} value={a.email}>
            {a.label} — {a.email}
          </option>
        ))}
      </select>
    </form>
  );
}
