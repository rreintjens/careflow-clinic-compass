import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const icon = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {children}
  </svg>
);

const MAIN = [
  { to: "/dashboard", label: "Dashboard", icon: icon(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>) },
  { to: "/agenda", label: "Agenda", icon: icon(<><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>) },
  { to: "/patienten", label: "Patiënten", icon: icon(<><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 14.6c1.6.6 2.7 2.1 3 4.4" /></>) },
] as const;

const GROUPS = [
  {
    key: "organisatie",
    label: "Organisatie",
    icon: icon(<><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-6h6v6" /></>),
    items: [
      { to: "/organisatie/behandelingen", label: "Behandelingen" },
      { to: "/organisatie/behandelaars", label: "Behandelaars" },
      { to: "/organisatie/locaties", label: "Locaties" },
      { to: "/organisatie/apparatuur", label: "Apparatuur" },
    ],
  },
  {
    key: "boekingsflow",
    label: "Boekingsflow",
    icon: icon(<><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M8 7l8 4M8 17l8-4" /></>),
    items: [
      { to: "/boekingsflow/boekingslinks", label: "Boekingslinks" },
      { to: "/boekingsflow/vragenlijsten", label: "Vragenlijsten" },
      { to: "/boekingsflow/e-mails", label: "E-mails en sjablonen" },
    ],
  },
  {
    key: "instellingen",
    label: "Instellingen",
    icon: icon(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>),
    items: [
      { to: "/instellingen/algemeen", label: "Algemeen" },
      { to: "/instellingen/koppelingen", label: "Koppelingen" },
      { to: "/instellingen/gebruikers-en-rollen", label: "Gebruikers en rollen" },
      { to: "/instellingen/logboek", label: "Logboek" },
    ],
  },
] as const;

const Chevron = ({ up }: { up: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted-foreground">
    <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

export interface SidebarProps {
  fullName: string;
  email: string;
  roleName: string;
  onSignOut: () => void;
}

export function Sidebar({ fullName, email, roleName, onSignOut }: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.key, pathname.startsWith(`/${g.key}`)])),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = fullName.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const rowBase = "flex h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-sm font-medium";

  return (
    <aside aria-label="Beheermenu" className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-5 overflow-y-auto bg-sidebar px-3.5 pb-4 pt-[22px]">
      <div className="flex h-10 items-center gap-2.5 px-2.5">
        <Logo small />
        <span className="whitespace-nowrap rounded-full bg-teal-light px-2.5 py-[3px] text-xs font-semibold text-primary-hover">Beheer</span>
      </div>
      <nav aria-label="Hoofdmenu" className="flex flex-col gap-0.5">
        {MAIN.map((m) => {
          const active = pathname === m.to || pathname.startsWith(`${m.to}/`);
          return (
            <Link key={m.to} to={m.to} className={cn(rowBase, active ? "bg-sidebar-accent text-primary" : "text-foreground hover:text-primary")}>
              {m.icon}
              {m.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-2.5 border-t border-sidebar-border pt-4">
        {GROUPS.map((g) => (
          <div key={g.key} className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-expanded={open[g.key]}
              onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              className={cn(rowBase, "w-full text-left text-foreground hover:text-primary")}
            >
              {g.icon}
              <span className="flex-1">{g.label}</span>
              <Chevron up={Boolean(open[g.key])} />
            </button>
            {open[g.key] && (
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = pathname.startsWith(it.to);
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center whitespace-nowrap rounded-xl pl-11 pr-3 text-sm font-medium",
                        active ? "bg-sidebar-accent text-primary" : "text-foreground hover:text-primary",
                      )}
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        {menuOpen && (
          <div className="flex flex-col rounded-[14px] border border-mist bg-background p-1.5 shadow-[0_8px_24px_rgba(57,51,46,0.10)]">
            <span className="whitespace-nowrap px-3 pb-1.5 pt-2 text-xs text-muted-foreground">{email}</span>
            <button type="button" onClick={onSignOut} className="flex h-10 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 text-left text-sm font-medium hover:bg-sand">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-primary">
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                <path d="M9 8l-4 4 4 4M5 12h10" />
              </svg>
              Uitloggen
            </button>
          </div>
        )}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={`Accountmenu van ${fullName}`}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-[14px] bg-background px-3 py-2.5 text-left"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-light text-[13px] font-semibold text-primary-hover">{initials}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{fullName}</span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">{roleName}</span>
          </span>
          <Chevron up={!menuOpen} />
        </button>
      </div>
    </aside>
  );
}
