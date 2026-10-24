import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Card } from "@/components/Card";
import { tdCls, thCls } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { getDashboard } from "@/data/integrations.functions";
import { textOf, uiTextsQuery } from "@/data/ui-texts";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Beheer · The Body Clinic" }, { name: "description", content: "Dashboard bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:title", content: "Dashboard · Beheer · The Body Clinic" }, { property: "og:description", content: "Dashboard bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(uiTextsQuery("dashboard_ui")), context.queryClient.ensureQueryData(dashboardQuery)]),
  errorComponent: () => <p role="alert">Dashboard laden is niet gelukt.</p>,
  notFoundComponent: () => <p>Dashboard niet gevonden.</p>,
  component: DashboardPage,
});

/** Fills the {placeholders} in a configured sentence with today's numbers. */
const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

function DashboardPage() {
  const { data: texts } = useSuspenseQuery(uiTextsQuery("dashboard_ui"));
  const { data: d } = useSuspenseQuery(dashboardQuery);
  const navigate = useNavigate();
  const t = (key: string) => textOf(texts, key);

  const title = `Vandaag, ${new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d.today.date}T12:00:00Z`))}`;
  const diff = d.today.arrivals - d.today.avgArrivals;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={t("page_desc")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("kpi_arrivals")} value={d.today.arrivals} note={fill(diff >= 0 ? t("note_avg_more") : t("note_avg_less"), { verschil: Math.abs(diff), gemiddeld: d.today.avgArrivals })} />
        <Kpi label={t("kpi_appointments")} value={d.today.appointments} note={fill(t("note_occupancy"), { percent: d.today.occupancy })} />
        <Kpi label={t("kpi_open")} value={d.today.openQuestionnaires} note={fill(t("note_open"), { afspraken: d.today.appointments, later: d.today.openLater })} />
        <Kpi label={t("kpi_noshow")} value={d.today.noShowsWeek} note={fill(t("note_noshow"), { percent: d.today.noShowRate })} />
      </div>

      <Card title={t("loc_title")} description={t("loc_desc")}>
        {d.perLocation.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no_data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className={thCls}>{t("col_locatie")}</th>
                  <th className={`${thCls} text-right`}>{t("col_afspraken")}</th>
                  <th className={`${thCls} text-right`}>{t("col_vrij")}</th>
                  <th className={`${thCls} text-right`}>{t("col_bezetting")}</th>
                  <th className={`${thCls} text-right`}>{t("col_noshow")}</th>
                </tr>
              </thead>
              <tbody>
                {d.perLocation.map((l) => (
                  <tr key={l.location} className="border-t border-line">
                    <td className={tdCls}>{l.location}</td>
                    <td className={`${tdCls} text-right`}>{l.appointments}</td>
                    <td className={`${tdCls} text-right`}>{l.free}</td>
                    <td className={`${tdCls} text-right`}>{l.occupancy}%</td>
                    <td className={`${tdCls} text-right`}>{l.noShows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t("group_title")}>
        {d.perGroup.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no_data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className={thCls}>{t("col_groep")}</th>
                  <th className={`${thCls} text-right`}>{t("col_afspraken")}</th>
                  <th className={`${thCls} text-right`}>{t("col_nieuw")}</th>
                  <th className={`${thCls} text-right`}>{t("col_open")}</th>
                </tr>
              </thead>
              <tbody>
                {d.perGroup.map((g) => (
                  <tr key={g.group} className="border-t border-line">
                    <td className={tdCls}>{g.group}</td>
                    <td className={`${tdCls} text-right`}>{g.appointments}</td>
                    <td className={`${tdCls} text-right`}>{g.newPatients}</td>
                    <td className={`${tdCls} text-right`}>{g.openQuestionnaires}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t("source_title")} description={t("source_desc")}>
        {d.perSource.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no_data")}</p>
        ) : (
          <ul className="flex flex-col">
            {d.perSource.map((s) => (
              <li key={s.source} className="flex items-baseline justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
                <span className="text-sm">{s.source}</span>
                <span className="text-sm text-muted-foreground">{s.count} · {s.share}%</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="text-sm leading-[1.6] text-muted-foreground">{t("stats_note")}</p>
        <p className="mt-3 text-sm">
          {t("stats_last")}: {d.lastStatsAt ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(d.lastStatsAt)) : d.statsKeySet ? "–" : t("stats_key_missing")}
        </p>
        <div className="mt-5">
          <PillButton variant="outline" onClick={() => navigate({ to: "/instellingen/koppelingen" })}>{t("btn_koppelingen")}</PillButton>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[34px] font-light leading-[1.1]">{value}</span>
      <span className="text-[13px] leading-[1.5] text-muted-foreground">{note}</span>
    </Card>
  );
}
