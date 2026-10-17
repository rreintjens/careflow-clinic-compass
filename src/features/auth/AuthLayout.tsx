import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-30px)] lg:grid-cols-2">
      <aside className="flex flex-col justify-between bg-sand p-12">
        <Logo />
        <div className="max-w-[420px] py-10">
          <h1 className="text-[30px] font-semibold tracking-tight">Agenda en dossier</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Voor artsen, behandelaars en customer care van The Body Clinic. Alleen voor bevoegde medewerkers; elke aanmelding wordt vastgelegd.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Testomgeving · geen echte patiëntgegevens</span>
      </aside>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </div>
  );
}
