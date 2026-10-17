import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { usersQuery } from "@/data/roles";
import { supabase } from "@/integrations/supabase/client";

const CATEGORY_LABELS: Record<string, string> = {
  login: "Ingelogd",
  changed: "Gewijzigd",
  created: "Aangemaakt",
  viewed: "Bekeken",
  medical: "Medische gegevens",
  email: "E-mail",
  exported: "Geëxporteerd",
  integration: "Koppeling",
};

const logQuery = (category: string, userId: string) =>
  queryOptions({
    queryKey: ["audit", category, userId],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("id, at, user_id, action, category, record_type, record_id, ip").order("at", { ascending: false }).limit(200);
      if (category !== "all") q = q.eq("category", category);
      if (userId !== "all") q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const Route = createFileRoute("/_authenticated/instellingen/logboek")({
  head: () => ({ meta: [{ title: "Logboek · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery("all", "all")),
  component: LogPage,
});

const timeFmt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Amsterdam" });

function LogPage() {
  const [category, setCategory] = useState("all");
  const [userId, setUserId] = useState("all");
  const { data: rows } = useSuspenseQuery(logQuery(category, userId));
  const users = useQuery(usersQuery);
  const name = (id: string | null) => (id ? (users.data?.find((u) => u.id === id)?.full_name ?? "Onbekend") : "Systeem");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Logboek" />
      <div className="grid max-w-[640px] grid-cols-2 gap-4">
        <Select
          label="Gebruiker"
          value={userId}
          onChange={setUserId}
          options={[{ value: "all", label: "Alle gebruikers" }, ...(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))]}
        />
        <Select
          label="Actie"
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "Alle acties" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      <Card>
        <ul className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[150px_150px_120px_1fr_120px] items-center gap-4 py-3">
              <span className="text-muted-foreground">{timeFmt.format(new Date(r.at))}</span>
              <span className="truncate font-medium">{name(r.user_id)}</span>
              <span>
                <span className="whitespace-nowrap rounded-full bg-teal-light px-2.5 py-1 text-xs text-primary-hover">{CATEGORY_LABELS[r.category] ?? r.category}</span>
              </span>
              <span className="truncate">
                {r.action}
                {r.record_type && <span className="text-muted-foreground"> · {r.record_type}{r.record_id ? ` ${r.record_id}` : ""}</span>}
              </span>
              <span className="truncate text-xs text-muted-foreground">{r.ip}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
