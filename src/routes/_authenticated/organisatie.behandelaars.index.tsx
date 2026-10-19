import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/Avatar";
import { Chip, PlusIcon, SearchField, StatusMark, TextField, TextLink, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { MultiSelect } from "@/components/MultiSelect";
import { Select } from "@/components/Select";
import { allBlocksQuery, createPractitioner, fullName, locName, opts, orgQuery, roleName, workLocationIds, type Org } from "@/data/organisation";
import { scheduleStatus } from "@/domain/organisation";

export const Route = createFileRoute("/_authenticated/organisatie/behandelaars/")({
  head: () => ({ meta: [{ title: "Behandelaars · Beheer · The Body Clinic" }, { name: "description", content: "Behandelaars bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:title", content: "Behandelaars · Beheer · The Body Clinic" }, { property: "og:description", content: "Behandelaars bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(orgQuery), context.queryClient.ensureQueryData(allBlocksQuery)]),
  component: PractitionersPage,
});

const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" });

function PractitionersPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const { data: blocks } = useSuspenseQuery(allBlocksQuery);
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const [locF, setLocF] = useState("all");
  const [statusF, setStatusF] = useState("active");
  const [newOpen, setNewOpen] = useState(false);

  const filtered = [...org.practitioners].sort((a, b) => fullName(a).localeCompare(fullName(b), "nl"))
    .filter((p) => !q || fullName(p).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => roleF === "all" || p.role_id === roleF)
    .filter((p) => locF === "all" || workLocationIds(org, p.id).includes(locF))
    .filter((p) => statusF === "all" || p.status === statusF);
  const shown = filtered;

  return (
    <ListPage>
      <PageHeader
        title="Behandelaars"
        description="Iedereen die afspraken doet: artsen, huidtherapeuten, laserspecialisten en coaches. Klik op een naam voor profiel, werklocaties, behandelingen en rooster."
        actions={<PillButton size="lg" onClick={() => setNewOpen(true)}><PlusIcon />Nieuwe behandelaar</PillButton>}
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField placeholder="Zoek op naam" value={q} onChange={(e) => setQ(e.target.value)} className="w-[300px]" aria-label="Zoek op naam" />
        <Select label="Rol" value={roleF} onChange={setRoleF} options={[{ value: "all", label: "Alle rollen" }, ...org.roles.map((r) => ({ value: r.id, label: r.name_nl }))]} className="w-[160px] [&>label]:sr-only" />
        <Select label="Locatie" value={locF} onChange={setLocF} options={[{ value: "all", label: "Alle locaties" }, ...org.locations.map((l) => ({ value: l.id, label: l.name }))]} className="w-[200px] [&>label]:sr-only" />
        <Select label="Status" value={statusF} onChange={setStatusF} options={[{ value: "all", label: "Alle statussen" }, ...opts(org, "practitioner_status")]} className="w-[150px] [&>label]:sr-only" />
        <span className="ml-auto text-xs text-muted-foreground">{shown.length} behandelaars</span>
      </div>
      <div className="overflow-x-auto">
        <DataTable count={shown.length} label="behandelaars"><table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-line">
              <th className={thCls}>Behandelaar</th><th className={thCls}>Rol</th><th className={thCls}>Werklocaties</th><th className={thCls}>Behandelingen</th><th className={thCls}>Rooster</th><th className={thCls} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((p) => {
              const s = scheduleStatus(blocks.filter((b) => b.practitioner_id === p.id));
              return (
                <tr key={p.id} data-list-row>
                  <td className={tdCls}><Link to="/organisatie/behandelaars/$id" params={{ id: p.id }} className="flex items-center gap-3 whitespace-nowrap"><Avatar path={p.photo_path} size={36} />{fullName(p)}</Link></td>
                  <td className={tdCls}>{roleName(org, p.role_id)}</td>
                  <td className={tdCls}>{workLocationIds(org, p.id).map((l) => locName(org, l)).join(", ")}</td>
                  <td className={tdCls}>{org.practitionerTreatments.filter((x) => x.practitioner_id === p.id).length}</td>
                  <td className={tdCls}>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <StatusMark kind={s.kind === "open" ? "ok" : "warn"} />
                      {s.kind === "open" ? "Rooster tot nader order" : s.kind === "none" ? "Nog geen rooster" : `Geen rooster na ${dateFmt.format(new Date(`${s.date}T00:00:00Z`))}`}
                    </span>
                  </td>
                  <td className={tdCls}><Link to="/organisatie/behandelaars/$id" params={{ id: p.id }} className="text-sm text-primary underline underline-offset-2" aria-label="Openen"><RowChevron/></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table></DataTable>
      </div>
      {newOpen && <NewPractitionerModal org={org} onClose={() => setNewOpen(false)} />}
    </ListPage>
  );
}

function NewPractitionerModal({ org, onClose }: { org: Org; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [role, setRole] = useState(org.roles[0]?.id ?? "");
  const [locs, setLocs] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => createPractitioner({ first_name: first.trim(), last_name: last.trim(), role_id: role, locationIds: locs }),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: orgQuery.queryKey });
      toast.success("Behandelaar aangemaakt");
      onClose();
      void navigate({ to: "/organisatie/behandelaars/$id", params: { id } });
    },
    onError: () => toast.error("Aanmaken is niet gelukt"),
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nieuwe behandelaar"
      description="Daarna vul je op de pagina van de behandelaar het profiel, de behandelingen en het rooster in."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!first.trim() || !last.trim() || !role || create.isPending} onClick={() => create.mutate()}>Aanmaken</PillButton></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Voornaam" value={first} onChange={(e) => setFirst(e.target.value)} />
        <TextField label="Achternaam" value={last} onChange={(e) => setLast(e.target.value)} />
        <Select label="Rol" value={role} onChange={setRole} options={org.roles.map((r) => ({ value: r.id, label: r.name_nl }))} className="col-span-2" />
      </div>
      <MultiSelect label="Werklocaties" options={org.locations.map(l => ({ value: l.id, label: l.name }))} value={locs} onChange={setLocs} className="mt-5" />
    </Modal>
  );
}
