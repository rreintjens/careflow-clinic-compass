import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, ListPage, RowChevron } from "@/components/ListPage";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { PlusIcon, SearchField, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { categoryLabel, conceptOf, createTemplate, liveOf, templatesQuery } from "@/data/dossier";
import { VersionPill } from "@/features/questionnaire/VersionPill";

const TITLE = "Dossiersjablonen · The Body Clinic";
const DESC = "Per (sub)categorie de consultstappen en vragen die de arts krijgt.";
export const Route = createFileRoute("/_authenticated/dossier/dossiersjablonen/")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(templatesQuery),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { data } = useSuspenseQuery(templatesQuery);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = data.templates.filter((t) => `${t.name} ${categoryLabel(data.categories, t.category_id)}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <ListPage>
      <PageHeader title="Dossiersjablonen" description="Eén sjabloon per (sub)categorie. Een behandeling in meerdere categorieën krijgt alle live sjablonen samen." actions={<PillButton onClick={() => setAdding(true)}><PlusIcon />Nieuw sjabloon</PillButton>} />
      <div className="flex items-center gap-3"><SearchField aria-label="Zoek sjabloon" placeholder="Zoek sjabloon of categorie" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[300px]" /><span className="ml-auto text-xs text-muted-foreground">{shown.length} sjablonen</span></div>
      <DataTable count={shown.length} label="sjablonen">
        <table className="w-full min-w-[820px]">
          <thead><tr className="border-b border-line"><th className={thCls}>Sjabloon</th><th className={thCls}>Categorie</th><th className={thCls}>Stappen</th><th className={thCls}>Versie</th><th className={thCls}><span className="sr-only">Openen</span></th></tr></thead>
          <tbody>
            {shown.map((t) => {
              const live = liveOf(data.versions, t.id); const concept = conceptOf(data.versions, t.id);
              return (
                <tr key={t.id} className="border-b border-line">
                  <td className={tdCls}><Link to="/dossier/dossiersjablonen/$id" params={{ id: t.id }}>{t.name}</Link></td>
                  <td className={tdCls}>{categoryLabel(data.categories, t.category_id)}</td>
                  <td className={tdCls}>{(live ?? concept)?.content.steps.length ?? 0}</td>
                  <td className={tdCls}><div className="flex gap-1.5">{live && <VersionPill tone="live">Versie {live.version} live</VersionPill>}{concept && <VersionPill tone="draft">Concept {concept.version}</VersionPill>}</div></td>
                  <td className={tdCls}><Link to="/dossier/dossiersjablonen/$id" params={{ id: t.id }} aria-label="Openen" className="text-primary"><RowChevron /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>
      {adding && <NewTemplateModal onClose={() => setAdding(false)} />}
    </ListPage>
  );
}

function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const { data } = useSuspenseQuery(templatesQuery);
  const [cat, setCat] = useState("");
  const qc = useQueryClient(); const nav = useNavigate();
  const taken = new Set(data.templates.map((t) => t.category_id));
  const create = useMutation({
    mutationFn: () => createTemplate(cat, categoryLabel(data.categories, cat)),
    onSuccess: async (id) => { await qc.invalidateQueries({ queryKey: templatesQuery.queryKey }); onClose(); nav({ to: "/dossier/dossiersjablonen/$id", params: { id } }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal open title="Nieuw sjabloon" description="Kies de (sub)categorie waar dit sjabloon voor geldt." onOpenChange={(o) => !o && onClose()}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!cat || create.isPending} onClick={() => create.mutate()}>Aanmaken</PillButton></>}>
      <Select label="Categorie" value={cat} onChange={setCat} options={data.categories.map((c) => ({ value: c.id, label: categoryLabel(data.categories, c.id), disabled: taken.has(c.id), reason: taken.has(c.id) ? "Heeft al een sjabloon" : undefined }))} />
    </Modal>
  );
}
