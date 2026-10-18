import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { downloadEkisFile, getKoppelingen, rotateStatsKey, runEkisNow, setMeetAccount } from "@/data/integrations.functions";
import { textOf, uiTextsQuery } from "@/data/ui-texts";

const koppelingenQuery = queryOptions({ queryKey: ["koppelingen"], queryFn: () => getKoppelingen() });

export const Route = createFileRoute("/_authenticated/instellingen/koppelingen")({
  head: () => ({ meta: [{ title: "Koppelingen · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(uiTextsQuery("koppelingen_ui")), context.queryClient.ensureQueryData(koppelingenQuery)]),
  component: KoppelingenPage,
});

const dayTime = (iso: string | null) => (iso ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "–");

function KoppelingenPage() {
  const { data: texts } = useSuspenseQuery(uiTextsQuery("koppelingen_ui"));
  const { data: k } = useSuspenseQuery(koppelingenQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const t = (key: string) => textOf(texts, key);
  const refresh = () => qc.invalidateQueries({ queryKey: koppelingenQuery.queryKey });

  const [accountOpen, setAccountOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const exportNow = useMutation({
    mutationFn: () => runEkisNow(),
    onSuccess: (r) => {
      toast.success(`${t("btn_export_now")}: ${r.patients} patiënten en ${r.answerSets} vragenlijsten`);
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Exporteren is niet gelukt"),
  });

  const download = useMutation({
    mutationFn: () => downloadEkisFile(),
    onSuccess: (r) => {
      const name = `ekis-${r.ranAt.slice(0, 10)}.json`;
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.document, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(name);
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Downloaden is niet gelukt"),
  });

  const rotate = useMutation({
    mutationFn: () => rotateStatsKey(),
    onSuccess: (r) => {
      setNewKey(r.key);
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "De sleutel is niet vernieuwd"),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Koppelingen" description={t("page_desc")} />

      <Card title={t("title_ekis")} description={t("ekis_desc")}>
        <Rows
          rows={[
            [t("lbl_hoe"), t("ekis_hoe")],
            [t("lbl_laatste_export"), k.ekis.last ? `${k.ekis.lastLabel}, ${k.ekis.last.patients} patiënten en ${k.ekis.last.answerSets} vragenlijsten` : "–"],
            [t("lbl_volgende_export"), k.ekis.nextLabel],
            [t("lbl_terug"), t("ekis_terug")],
          ]}
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <PillButton variant="outline" disabled={!k.ekis.last || download.isPending} onClick={() => download.mutate()}>{t("btn_download")}</PillButton>
          <PillButton disabled={!k.ekis.enabled || exportNow.isPending} onClick={() => exportNow.mutate()}>{t("btn_export_now")}</PillButton>
        </div>
      </Card>

      <Card title={t("title_meet")} description={t("meet_desc")}>
        <Rows
          rows={[
            [t("lbl_actief"), k.meet.account ? t("meet_actief") : t("state_nog_niet")],
            [t("lbl_waar"), t("meet_waar")],
            [t("lbl_verzetten"), t("meet_verzetten")],
            [t("lbl_account"), k.meet.account ?? "–"],
            [t("lbl_laatste_link"), dayTime(k.meet.lastLinkAt)],
          ]}
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PillButton variant="outline" onClick={() => setAccountOpen(true)}>{t("btn_account")}</PillButton>
          {!k.groupAdmin && <span className="text-[13px] text-muted-foreground">{t("help_group")}</span>}
        </div>
      </Card>

      <Card title={t("title_mail")} description={t("mail_desc")}>
        <Rows
          rows={[
            [t("lbl_afzender"), k.mail.sender ? `${k.mail.sender}${k.mail.verified ? "" : ` · ${t("state_niet_verifieerd")}`}` : "–"],
            [t("lbl_bounces"), t("mail_bounces")],
            [t("lbl_sms"), t("mail_sms")],
          ]}
        />
        <p className="mt-5 text-[13px] text-muted-foreground">{t("help_mail_open")}</p>
      </Card>

      <Card title={t("title_stats")} description={t("stats_desc")}>
        <Rows
          rows={[
            [t("lbl_wat"), t("stats_wat")],
            [t("lbl_sleutel"), k.stats.keySet ? t("stats_sleutel") : t("state_geen_sleutel")],
            [t("stats_last"), dayTime(k.stats.lastUsedAt)],
            [t("lbl_doc"), t("stats_doc")],
          ]}
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PillButton variant="outline" onClick={() => { setNewKey(null); setKeyOpen(true); }}>{t("btn_rotate")}</PillButton>
          {!k.groupAdmin && <span className="text-[13px] text-muted-foreground">{t("help_group")}</span>}
        </div>
      </Card>

      <Card title={t("title_web")} description={t("web_desc")}>
        <Rows
          rows={[
            [t("lbl_links"), String(k.bookingLinks.active)],
            [t("lbl_meest"), k.bookingLinks.mostUsed ?? "–"],
            [t("lbl_bron"), t("web_bron")],
          ]}
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <PillButton variant="outline" onClick={() => navigate({ to: "/boekingsflow/boekingslinks" })}>{t("btn_links")}</PillButton>
        </div>
      </Card>

      <Card title={t("title_pay")} description={t("pay_desc")}>
        <Rows rows={[[t("lbl_actief"), t("state_nog_niet")], [t("lbl_nodig"), t("pay_nodig")]]} />
      </Card>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} account={k.meet.account} onSaved={refresh} />
      <KeyModal open={keyOpen} onClose={() => setKeyOpen(false)} newKey={newKey} t={t} rotate={rotate} />
    </div>
  );
}

function Rows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div>
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[180px_minmax(0,1fr)] gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
          <span className="text-[13px] text-muted-foreground">{k}</span>
          <span className="text-sm leading-[1.5]">{v}</span>
        </div>
      ))}
    </div>
  );
}

function AccountModal({ open, onClose, account, onSaved }: { open: boolean; onClose: () => void; account: string | null; onSaved: () => void }) {
  const setAccount = useServerFn(setMeetAccount);
  const [value, setValue] = useState(account ?? "");
  const save = useMutation({
    mutationFn: () => setAccount({ data: { account: value } }),
    onSuccess: () => {
      toast.success("Gekoppelde account gewijzigd");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Opslaan is niet gelukt"),
  });
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Gekoppeld account"
      description="Het account dat per online afspraak de agenda-afspraak en de Meet-link maakt."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}
    >
      <TextField label="E-mailadres van het account" value={value} onChange={(e) => setValue(e.target.value)} />
    </Modal>
  );
}

function KeyModal({ open, onClose, newKey, t, rotate }: { open: boolean; onClose: () => void; newKey: string | null; t: (k: string) => string; rotate: { mutate: () => void; isPending: boolean } }) {
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("btn_rotate")}
      description={newKey ? "Deze sleutel werkt vanaf nu; de oude is niet meer geldig. Kopieer hem nu, want hij wordt niet opnieuw getoond." : "Er wordt een nieuwe sleutel gemaakt. De oude sleutel stopt onmiddellijk."}
      footer={<><PillButton variant="outline" onClick={onClose}>Sluiten</PillButton>{!newKey && <PillButton disabled={rotate.isPending} onClick={() => rotate.mutate()}>{t("btn_rotate")}</PillButton>}</>}
    >
      {newKey ? (
        <div className="flex flex-col gap-3">
          <p className="break-all rounded-[14px] bg-sand p-4 font-mono text-[13px]">{newKey}</p>
          <button type="button" className="self-start text-[13px] text-primary underline" onClick={() => void navigator.clipboard.writeText(newKey).then(() => toast.success("Sleutel gekopieerd"), () => toast.error("Kopiëren is niet gelukt"))}>
            Sleutel kopiëren
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("stats_sleutel")} · {t("stats_desc")}</p>
      )}
    </Modal>
  );
}
