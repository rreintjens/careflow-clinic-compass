import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PlusIcon, SearchField, StatusMark, Tag, TextField, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { createLocation, opts, orgQuery } from "@/data/organisation";
import { notBookableAt } from "@/features/organisation/bookability";

export const Route = createFileRoute("/_authenticated/organisatie/locaties/")({
  head: () => ({ meta: [{ title: "Locaties · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(orgQuery),
  component: LocationsPage,
});

function LocationsPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const rows = org.locations
    .filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()))
    .filter((l) => statusF === "all" || l.status === statusF);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locaties"
        description="Online staat er altijd bij als vaste locatie. Klik op een locatie voor adres, openingstijden, kamers en behandelingen."
        actions={<PillButton size="lg" onClick={() => setNewOpen(true)}><PlusIcon />Nieuwe locatie</PillButton>}
      />
      <div className="flex items-center gap-2.5">
        <SearchField placeholder="Zoek een locatie" value={q} onChange={(e) => setQ(e.target.value)} className="w-[300px]" aria-label="Zoek een locatie" />
        <Select label="Status" value={statusF} onChange={setStatusF} options={[{ value: "all", label: "Alle statussen" }, ...opts(org, "location_status")]} className="w-[200px] [&>label]:sr-only" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-line">
              <th className={thCls}>Locatie</th><th className={thCls}>Adres</th><th className={thCls}>Status</th><th className={thCls}>Behandelingen</th><th className={thCls}>Kamers</th><th className={thCls}>Behandelaars</th><th className={thCls}>Boekbaarheid</th><th className={thCls} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((l) => {
              const online = l.kind === "online";
              const nb = notBookableAt(org, l.id);
              return (
                <tr key={l.id}>
                  <td className={tdCls}><Link to="/organisatie/locaties/$id" params={{ id: l.id }} className="whitespace-nowrap hover:text-primary">{l.name}</Link></td>
                  <td className={tdCls}>{l.address}</td>
                  <td className={tdCls}><Tag tone={online ? "teal" : "sand"}>{online ? "Vast" : l.status === "open" ? "Open" : "Gesloten"}</Tag></td>
                  <td className={tdCls}>{org.treatmentLocations.filter((x) => x.location_id === l.id).length}</td>
                  <td className={tdCls}>{online ? "–" : org.rooms.filter((r) => r.location_id === l.id).length}</td>
                  <td className={tdCls}>{org.practitionerLocations.filter((x) => x.location_id === l.id).length}</td>
                  <td className={tdCls}>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <StatusMark kind={nb === 0 ? "ok" : "warn"} />
                      {nb === 0 ? "Boekbaar" : `${nb} ${nb === 1 ? "behandeling" : "behandelingen"} niet boekbaar`}
                    </span>
                  </td>
                  <td className={tdCls}><Link to="/organisatie/locaties/$id" params={{ id: l.id }} className="text-sm text-primary underline underline-offset-2">Wijzig</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {newOpen && <NewLocationModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function NewLocationModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pc, setPc] = useState("");
  const create = useMutation({
    mutationFn: () => createLocation({ name: name.trim(), address: address.trim(), postal_city: pc.trim() }),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: orgQuery.queryKey });
      toast.success("Locatie aangemaakt");
      onClose();
      void navigate({ to: "/organisatie/locaties/$id", params: { id } });
    },
    onError: () => toast.error("Aanmaken is niet gelukt"),
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nieuwe locatie"
      description="Daarna vul je op de pagina van de locatie de openingstijden, kamers en behandelingen in."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>Aanmaken</PillButton></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} />
        <TextField label="Postcode en plaats" value={pc} onChange={(e) => setPc(e.target.value)} className="col-span-2" />
      </div>
    </Modal>
  );
}
