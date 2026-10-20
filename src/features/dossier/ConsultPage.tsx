import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Card } from "@/components/Card";
import { Checkbox, TextArea, TextField, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { UiIcon } from "@/components/UiIcon";
import { consultPageQuery, patientPhotosQuery, type ConsultPageData } from "@/data/consult-steps";
import { createPhotoToken, readyForPayment, recordVatDecision, saveStepData, sendGpLetter, sendPrescription, shareConsultPhoto, signPrescription } from "@/data/consult-steps.functions";
import { recordKey } from "@/data/patients";
import { closeChecklist, euros, gpLetterText, lineTotal, readStepData, type StepData } from "@/domain/consult-steps";
import { mockDictationProvider, mockTranscriptProvider } from "@/domain/consult-providers";
import type { LibraryQuestion } from "@/domain/dossier-templates";
import { answerText } from "@/domain/questionnaire/answers";
import { formatClinicalDate } from "@/domain/time";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SOEP = [["subjective", "Subjectief"], ["objective", "Objectief"], ["evaluation", "Evaluatie"], ["plan", "Plan"]] as const;
const hm = (s: string | Date) => new Date(s).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
const STEP_TITLES: Record<string, string> = { medische_status: "Medische status", anamnese: "Anamnese", diagnose: "Diagnose en besproken", plan_recept: "Plan en recept", behandeling: "Behandeling", afronden: "Afronden" };

type Note = ConsultPageData["note"];

/** The consult page: a stepper built from the dossier template, next to the sticky bar and floating notes. */
export function ConsultPage({ noteId }: { noteId: string }) {
  const qc = useQueryClient();
  const { data: d } = useQuery(consultPageQuery(noteId));
  const [step, setStep] = useState(0);
  const [local, setLocal] = useState<StepData | null>(null);
  const [soep, setSoep] = useState<{ subjective: string; objective: string; evaluation: string; plan: string }>({ subjective: "", objective: "", evaluation: "", plan: "" });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { if (d && !local) { setLocal(d.note.step_data); setSoep({ subjective: d.note.subjective, objective: d.note.objective, evaluation: d.note.evaluation, plan: d.note.plan }); } }, [d, local]);
  if (!d || !local) return <p className="text-sm text-muted-foreground">Consult laden…</p>;

  const content = d.template?.content;
  const steps = content?.steps.length ? content.steps : ["anamnese", "afronden"];
  const current = steps[Math.min(step, steps.length - 1)]!;
  const lib = (code: string) => d.library.find((q) => q.code === code);

  const patch = (p: Partial<StepData>) => {
    const next = { ...local, ...p };
    setLocal(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveStepData({ data: { noteId, stepData: next as unknown as Record<string, unknown> } }).then(() => setSavedAt(hm(new Date()))).catch(() => toast.error("Opslaan is niet gelukt")); }, 400);
  };
  const patchSoep = (k: string, v: string) => {
    const next = { ...soep, [k]: v };
    setSoep(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await supabase.from("consult_notes").update(next).eq("id", noteId);
      if (r.error) toast.error("Opslaan is niet gelukt"); else setSavedAt(hm(new Date()));
    }, 400);
  };

  const soepFilled = SOEP.filter(([k]) => (soep[k] ?? "").trim()).length;
  const checklist = content ? closeChecklist(content, local, { prescriptionSigned: d.prescription ? d.prescription.status !== "concept" : content.steps.includes("plan_recept") ? false : null, photoCount: d.photos.length, soepFilled }) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/patienten/$id" params={{ id: recordKey(d.patient) }} className="text-[13px] text-primary">Dossier</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Consult · {d.patient.first_name} {d.patient.last_name}</h1>
          {d.template && <span className="whitespace-nowrap rounded-full bg-teal-light px-3 py-1 text-[12px] text-primary">Sjabloon {d.template.name} · v{d.template.version}</span>}
          <span className="ml-auto text-[13px] text-muted-foreground">Alles wordt direct bewaard{savedAt ? ` · ${savedAt}` : ""}</span>
        </div>
        {d.appointment && <p className="mt-1 text-[15px] text-muted-foreground">{d.appointment.treatment?.name_nl} · {d.appointment.practitioner?.first_name} {d.appointment.practitioner?.last_name}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button key={s} type="button" onClick={() => setStep(i)} className={cn("whitespace-nowrap rounded-full px-3.5 py-2 text-[13px]", i === step ? "bg-primary text-primary-foreground" : "bg-sand")}>{i + 1} {STEP_TITLES[s] ?? s}</button>
        ))}
      </div>

      {current === "medische_status" && <MedicalStatus d={d} />}
      {current === "anamnese" && <Anamnese d={d} data={local} soep={soep} patch={patch} patchSoep={patchSoep} lib={lib} />}
      {current === "diagnose" && content && <Diagnose d={d} data={local} patch={patch} lib={lib} content={content} />}
      {current === "plan_recept" && <Prescription d={d} data={local} />}
      {current === "behandeling" && content && <Treatment d={d} data={local} patch={patch} lib={lib} content={content} />}
      {current === "afronden" && content && <Closing d={d} data={local} patch={patch} checklist={checklist} />}
    </div>
  );
}

/** Stap 1: antwoorden uit de bevroren vragenlijstversie met signalen en een geldigheidslijn. */
function MedicalStatus({ d }: { d: ConsultPageData }) {
  const s = d.answerSet;
  const reask = d.template?.content.questionnaire.reaskDays ?? 0;
  const validUntil = s?.completed_at && reask ? new Date(new Date(s.completed_at).getTime() + reask * 86400_000) : null;
  const items = (s?.definition?.pages ?? []).flatMap((p) => p.items ?? []).filter((it) => it.type !== "answer_summary" && it.type !== "checkbox_required");
  const ans = (s?.answers ?? {}) as Record<string, unknown>;
  const sig = new Set((Array.isArray(s?.signals) ? (s!.signals as Array<{ item: string }>) : []).map((x) => x.item));
  return (
    <Card title="Medische status" description="De medische vragenlijst zoals de patiënt hem invulde.">
      {!s && <p className="text-sm text-muted-foreground">Nog geen ingevulde vragenlijst voor dit consult.</p>}
      {s && (
        <>
          <p className="mb-4 text-[13px] text-muted-foreground">Ingevuld {formatClinicalDate(s.completed_at ?? s.created_at)}{validUntil ? `, geldig tot ${formatClinicalDate(validUntil.toISOString())}` : reask === 0 ? ", wordt elke keer opnieuw gevraagd" : ""}</p>
          <dl className="grid grid-cols-1 gap-x-6">
            {items.filter((it) => answerText(it, ans) !== "").map((it) => (
              <div key={it.id} className="grid grid-cols-[220px_1fr] gap-4 border-b border-mist py-2.5 text-[13px]">
                <dt className="text-muted-foreground">{it.text}</dt>
                <dd>{answerText(it, ans)}{sig.has(it.id) && <span className="ml-2 whitespace-nowrap rounded-full bg-signal px-2.5 py-0.5 text-[11px] ring-1 ring-signal-border">signaal</span>}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {(d.template?.content.consentForms.length ?? 0) > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
          <span className="flex-1">Toestemmingsformulier: {d.template!.content.consentForms.join(", ")}</span>
          <PillButton size="sm" variant="outline">Bekijk PDF</PillButton>
          <PillButton size="sm" variant="outline">Op tablet</PillButton>
        </div>
      )}
    </Card>
  );
}

/** Stap 2: SOEP met sjabloon en dicteer, bibliotheekvragen en het gespreksverslag. */
function Anamnese({ d, data, soep, patch, patchSoep, lib }: { d: ConsultPageData; data: StepData; soep: Record<string, string>; patch: (p: Partial<StepData>) => void; patchSoep: (k: string, v: string) => void; lib: (c: string) => LibraryQuestion | undefined }) {
  const [dictating, setDictating] = useState<string | null>(null);
  const [rec, setRec] = useState<"idle" | "recording" | "proposal">(data.transcript.status === "idle" ? "idle" : data.transcript.status === "reviewed" ? "idle" : data.transcript.status);
  const dictate = async (k: string, label: string) => {
    setDictating(k);
    const text = await mockDictationProvider().recognise(label);
    patchSoep(k, `${soep[k] ?? ""}${soep[k] ? "\n" : ""}${text}`);
    setDictating(null);
  };
  const anamneseCodes = d.template?.content.anamnese ?? [];
  return (
    <div className="flex flex-col gap-6">
      <Card title="Consultverslag (SOEP)" description="Vrije velden; kies een sjabloon of dicteer.">
        <div className="flex flex-col gap-4">
          {SOEP.map(([k, label]) => (
            <div key={k}>
              <TextArea label={label} rows={3} value={soep[k] ?? ""} onChange={(e) => patchSoep(k, e.target.value)} />
              <div className="mt-1 flex gap-3">
                <Select label="Sjabloon" inline value="" onChange={(v) => { if (v) patchSoep(k, `${soep[k] ?? ""}${soep[k] ? "\n" : ""}${v}`); }} options={d.soepTemplates} />
                <TextLink onClick={() => void dictate(k, label)}>{dictating === k ? "Dicteren…" : "Dicteer"}</TextLink>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {anamneseCodes.length > 0 && (
        <Card title="Anamnesevragen" description="Uit het dossiersjabloon.">
          <div className="flex flex-col gap-3">
            {anamneseCodes.map((code) => {
              const q = lib(code);
              if (!q) return null;
              const v = data.libraryAnswers[code] ?? "";
              const set = (val: string) => patch({ libraryAnswers: { ...data.libraryAnswers, [code]: val } });
              return (
                <div key={code} className="rounded-[14px] bg-sand px-4 py-3">
                  <p className="mb-2 text-[14px]">{q.text_nl}</p>
                  {q.qtype === "yes_no" || q.qtype === "yes_no_note" ? (
                    <div className="flex gap-2">{["ja", "nee"].map((o) => <button key={o} type="button" onClick={() => set(o)} className={cn("rounded-full px-4 py-1.5 text-[13px]", v === o ? "bg-primary text-primary-foreground" : "bg-background")}>{o === "ja" ? "Ja" : "Nee"}</button>)}</div>
                  ) : q.options.length ? (
                    <Select label="Antwoord" inline value={v} onChange={set} options={q.options.map((o) => ({ value: o.value, label: o.label }))} />
                  ) : (
                    <input value={v} onChange={(e) => set(e.target.value)} className="w-full rounded-[12px] bg-background px-3 py-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Card title="Gespreksverslag" description="Neem het gesprek op; je krijgt een voorstel om te beoordelen.">
        {data.transcript.status === "reviewed" ? (
          <div className="rounded-[14px] bg-sand p-4 text-sm"><p className="mb-1 font-medium text-primary">Verslag beoordeeld en overgenomen</p><p className="whitespace-pre-wrap text-muted-foreground">{data.transcript.proposal}</p></div>
        ) : rec === "idle" ? (
          <PillButton variant="outline" onClick={async () => { await mockTranscriptProvider().start(d.note.id); setRec("recording"); }}>Opnemen starten</PillButton>
        ) : rec === "recording" ? (
          <div className="flex items-center gap-3"><span className="flex items-center gap-2 text-[14px]"><span className="size-2 animate-pulse rounded-full bg-warning" />Opname loopt…</span><PillButton size="sm" onClick={async () => { const r = await mockTranscriptProvider().stop("rec"); patch({ transcript: { status: "proposal", proposal: r.proposal } }); setRec("proposal"); }}>Stop en maak voorstel</PillButton></div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-medium text-primary">Voorstel klaar — beoordeel het voordat het dossier kan sluiten</p>
            <TextArea label="Voorstel" rows={4} value={data.transcript.proposal} onChange={(e) => patch({ transcript: { ...data.transcript, proposal: e.target.value } })} />
            <div className="flex gap-2">
              <PillButton size="sm" onClick={() => { patch({ transcript: { status: "reviewed", proposal: data.transcript.proposal } }); patchSoep("evaluation", `${soep["evaluation"] ?? ""}${soep["evaluation"] ? "\n" : ""}${data.transcript.proposal}`); setRec("idle"); }}>Overnemen</PillButton>
              <PillButton size="sm" variant="outline" onClick={() => patch({ transcript: { status: "idle", proposal: "" } })}>Verwerpen</PillButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Stap 3: diagnoses met code, bespreekpunten en het btw-besluit (alleen artsen). */
function Diagnose({ d, data, patch, lib, content }: { d: ConsultPageData; data: StepData; patch: (p: Partial<StepData>) => void; lib: (c: string) => LibraryQuestion | undefined; content: NonNullable<ConsultPageData["template"]>["content"] }) {
  const [vatAnswers, setVatAnswers] = useState<Record<string, string>>(data.vat?.answers ?? {});
  const [exempt, setExempt] = useState(data.vat?.exempt ?? false);
  const saveVat = useMutation({
    mutationFn: () => recordVatDecision({ data: { noteId: d.note.id, exempt, answers: vatAnswers, stepData: { ...data, vat: null } as unknown as Record<string, unknown> } }),
    onSuccess: () => { patch({ vat: { exempt, answers: vatAnswers, by: "arts", at: new Date().toISOString() } }); toast.success("Btw-besluit vastgelegd"); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="flex flex-col gap-6">
      <Card title="Diagnoses" description="Zoek op code of naam; voorgeselecteerd uit het sjabloon.">
        <MultiSelect label="Diagnosecodes (ICD-10)" value={data.diagnoses} onChange={(v) => patch({ diagnoses: v })} options={d.icd10} />
      </Card>
      {content.bespreekpunt.length > 0 && (
        <Card title="Besproken met patiënt" description="Elk punt is verplicht ja of nee; wordt vastgelegd met behandelaar en tijd.">
          <div className="flex flex-col gap-2">
            {content.bespreekpunt.map((code) => {
              const q = lib(code);
              const cur = data.discussed[code];
              const set = (answer: "ja" | "nee") => patch({ discussed: { ...data.discussed, [code]: { answer, by: `${d.appointment?.practitioner?.first_name ?? ""} ${d.appointment?.practitioner?.last_name ?? ""}`.trim(), at: new Date().toISOString() } } });
              return (
                <div key={code} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
                  <span className="flex-1">{q?.text_nl ?? code}</span>
                  {cur && <span className="text-[12px] text-muted-foreground">{cur.by} · {hm(cur.at)}</span>}
                  {(["ja", "nee"] as const).map((o) => <button key={o} type="button" onClick={() => set(o)} className={cn("rounded-full px-4 py-1.5 text-[13px]", cur?.answer === o ? "bg-primary text-primary-foreground" : "bg-background")}>{o === "ja" ? "Ja" : "Nee"}</button>)}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {d.appointment?.treatment?.vat_exemption_possible && content.fiscaal.length > 0 && (
        <Card title="Btw-vrijstelling" description="Alleen de arts legt dit vast.">
          {data.vat ? (
            <p className="rounded-[14px] bg-teal-light px-4 py-3 text-sm text-primary">{data.vat.exempt ? "Vrijgesteld van btw als medische dienst." : "Niet vrijgesteld: btw van toepassing."} Vastgelegd door {data.vat.by}, {formatClinicalDate(data.vat.at, true)}</p>
          ) : !d.permissions.vat ? (
            <p className="text-sm text-muted-foreground">Je hebt het recht “Btw-vrijstelling vastleggen” niet; alleen de arts beslist.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {content.fiscaal.map((code) => {
                const q = lib(code);
                return (
                  <div key={code} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
                    <span className="flex-1">{q?.text_nl ?? code}</span>
                    <Select label="Antwoord" inline value={vatAnswers[code] ?? ""} onChange={(v) => setVatAnswers({ ...vatAnswers, [code]: v })} options={(q?.options.length ? q.options : [{ value: "ja", label: "Ja" }, { value: "nee", label: "Nee" }]).map((o) => ({ value: o.value, label: o.label }))} />
                  </div>
                );
              })}
              <Checkbox checked={exempt} onChange={setExempt} label="Vrijgesteld van btw als medische dienst" />
              <div><PillButton size="sm" disabled={saveVat.isPending} onClick={() => saveVat.mutate()}>Leg het besluit vast</PillButton></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/** Stap 4 (medisch afvallen): recept met ondertekening en de apotheekroute (mock). */
function Prescription({ d, data }: { d: ConsultPageData; data: StepData }) {
  const qc = useQueryClient();
  const p = d.prescription;
  const [med, setMed] = useState(p?.medication ?? "");
  const [r, setR] = useState(p?.r_text ?? "");
  const [s, setS] = useState(p?.s_text ?? "");
  const [pharmacy, setPharmacy] = useState(p?.pharmacy_id ?? d.pharmacies.find((x) => x.name === "De Regio Apotheek")?.id ?? "");
  const [signing, setSigning] = useState(false);
  const [pdf, setPdf] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["consult-page", d.note.id] });
  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const statusLabel = (v: string) => ({ concept: "Concept", verstuurd: "Verstuurd naar apotheek", ontvangen: "Ontvangen door apotheek", klaargezet: "Klaargezet (wacht op betaling pakket)", verzonden: "Verzonden", ingetrokken: "Ingetrokken" })[v] ?? v;
  return (
    <Card title="Plan en recept" description="Het recept volgt op het behandelplan en het gekozen pakket.">
      <div className="flex flex-col gap-4">
        {p && <p className="rounded-[14px] bg-teal-light px-4 py-3 text-sm text-primary">Status: {statusLabel(p.status)}{p.signed_at ? ` · ondertekend ${formatClinicalDate(p.signed_at, true)}` : ""}</p>}
        <TextField label="Medicatie (uit het gekozen pakket)" value={med} onChange={(e) => setMed(e.target.value)} />
        <TextArea label="R/ (voorschrift)" rows={3} value={r} onChange={(e) => setR(e.target.value)} />
        <TextArea label="S/ (gebruiksaanwijzing)" rows={2} value={s} onChange={(e) => setS(e.target.value)} />
        <Select label="Apotheek" value={pharmacy} onChange={setPharmacy} options={d.pharmacies.map((x) => ({ value: x.id, label: `${x.name}${x.city ? `, ${x.city}` : ""}` }))} />
        <div className="flex flex-wrap gap-2">
          {d.permissions.sign ? <PillButton variant="outline" onClick={() => setSigning(true)}>Onderteken</PillButton> : <p className="text-[13px] text-muted-foreground">Alleen de arts ondertekent het recept.</p>}
          {p?.signature && <PillButton variant="outline" onClick={() => setPdf(true)}>Bekijk PDF</PillButton>}
          {p?.signature && p.status === "concept" && <PillButton disabled={mut.isPending} onClick={() => mut.mutate(() => sendPrescription({ data: { prescriptionId: p.id, action: "send" } }))}>Verstuur naar apotheek</PillButton>}
          {p && ["verstuurd", "ontvangen", "klaargezet"].includes(p.status) && <PillButton variant="outline" disabled={mut.isPending} onClick={() => mut.mutate(() => sendPrescription({ data: { prescriptionId: p.id, action: "poll" } }))}>Ververs status</PillButton>}
          {p && ["concept", "verstuurd"].includes(p.status) && <TextLink onClick={() => mut.mutate(() => sendPrescription({ data: { prescriptionId: p.id, action: "withdraw" } }))}>Trek in</TextLink>}
        </div>
      </div>
      {signing && <SignaturePad onClose={() => setSigning(false)} onSign={(sig) => mut.mutate(async () => { await signPrescription({ data: { noteId: d.note.id, patientId: d.patient.id, medication: med, rText: r, sText: s, pharmacyId: pharmacy || null, signature: sig } }); setSigning(false); toast.success("Recept ondertekend"); })} />}
      {pdf && p && (
        <Modal open onOpenChange={(o) => !o && setPdf(false)} title="Recept" footer={<PillButton variant="outline" onClick={() => setPdf(false)}>Sluiten</PillButton>}>
          <div className="rounded-[14px] bg-sand p-5 text-sm">
            <p className="mb-2 font-semibold">Recept · {d.patient.first_name} {d.patient.last_name} ({d.patient.patient_number})</p>
            <p className="whitespace-pre-wrap">R/ {p.r_text}{"\n\n"}S/ {p.s_text}</p>
            <p className="mt-3 text-muted-foreground">{p.medication} · {d.pharmacies.find((x) => x.id === p.pharmacy_id)?.name ?? "geen apotheek"}</p>
            {p.signature && <img src={p.signature} alt="Handtekening van de arts" className="mt-3 h-16 rounded-[8px] bg-background" />}
          </div>
        </Modal>
      )}
    </Card>
  );
}

/** Signature pad: draw with pointer, stored as image. */
function SignaturePad({ onSign, onClose }: { onSign: (dataUrl: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const start = (e: React.PointerEvent) => { drawing.current = true; const c = ref.current!.getContext("2d")!; c.strokeStyle = "#39332E"; c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(...pos(e)); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const c = ref.current!.getContext("2d")!; c.lineTo(...pos(e)); c.stroke(); setEmpty(false); };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Onderteken het recept" description="Zet je handtekening met de muis of vinger."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={empty} onClick={() => onSign(ref.current!.toDataURL("image/png"))}>Ondertekenen</PillButton></>}>
      <canvas ref={ref} width={520} height={200} className="w-full touch-none rounded-[14px] bg-sand" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
    </Modal>
  );
}

/** Stap 5 (cosmetisch): behandelregels met lot, foto's via de telefoon, vergelijken en tekenen. */
function Treatment({ d, data, patch, lib, content }: { d: ConsultPageData; data: StepData; patch: (p: Partial<StepData>) => void; lib: (c: string) => LibraryQuestion | undefined; content: NonNullable<ConsultPageData["template"]>["content"] }) {
  const qc = useQueryClient();
  const [addLine, setAddLine] = useState("");
  const [lotFor, setLotFor] = useState<number | null>(null);
  const [qr, setQr] = useState<{ slot: string; url: string; qr: string } | null>(null);
  const [compare, setCompare] = useState(false);
  const [draw, setDraw] = useState(false);
  const { data: allPhotos = [] } = useQuery(patientPhotosQuery(d.patient.id));
  const refresh = () => qc.invalidateQueries({ queryKey: ["consult-page", d.note.id] });
  useEffect(() => { if (!qr) return; const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [qr]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTreatment = (id: string) => {
    const t = d.treatments.find((x) => x.id === id);
    if (!t) return;
    const line = { treatmentId: t.id, name: t.name_nl, qty: 1, unit: t.material_unit ?? "eenheden", priceCents: t.price_cents ?? 0, lot: null };
    const lines = [...data.lines, line];
    patch({ lines });
    if (t.lot_required) setLotFor(lines.length - 1);
  };
  const makeQr = async (slot: string) => {
    try {
      const { token } = await createPhotoToken({ data: { noteId: d.note.id, slot } });
      const url = `${window.location.origin}/foto/${token}`;
      setQr({ slot, url, qr: await QRCode.toDataURL(url, { width: 220, margin: 1 }) });
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="flex flex-col gap-6">
      <Card title="Behandelregels" description="Zoek een behandeling of scan een barcode; aantal in de eenheid van de behandeling.">
        <div className="flex flex-col gap-3">
          {data.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
              <span className="flex-1">{l.name}{l.lot ? <span className="ml-2 text-[12px] text-muted-foreground">lot {l.lot.number} · exp {l.lot.expiryMonth}/{l.lot.expiryYear}</span> : null}</span>
              <button type="button" aria-label="Minder" className="flex size-7 items-center justify-center rounded-full bg-background" onClick={() => patch({ lines: data.lines.map((x, xi) => xi === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x) })}><UiIcon name="min" className="size-3.5" /></button>
              <span className="w-16 text-center">{l.qty} {l.unit}</span>
              <button type="button" aria-label="Meer" className="flex size-7 items-center justify-center rounded-full bg-background" onClick={() => patch({ lines: data.lines.map((x, xi) => xi === i ? { ...x, qty: x.qty + 1 } : x) })}><UiIcon name="plus" className="size-3.5" /></button>
              <span className="w-20 text-right">{euros(l.qty * l.priceCents)}</span>
              {!l.lot && d.treatments.find((t) => t.id === l.treatmentId)?.lot_required && <TextLink onClick={() => setLotFor(i)}>Lotnummer</TextLink>}
              <TextLink onClick={() => patch({ lines: data.lines.filter((_, xi) => xi !== i) })}>Verwijder</TextLink>
            </div>
          ))}
          <div className="flex items-end gap-3">
            <Select label="Behandeling toevoegen" inline value={addLine} onChange={(v) => { setAddLine(""); addTreatment(v); }} options={d.treatments.map((t) => ({ value: t.id, label: `${t.name_nl}${t.price_cents ? ` · ${euros(t.price_cents)}${t.price_per ? ` per ${t.price_per}` : ""}` : ""}` }))} />
            <PillButton variant="outline" size="sm" onClick={() => toast.info("Camera-demo: richt de camera op de barcode van het product")}>Scan barcode</PillButton>
            {data.lines.length > 0 && <span className="ml-auto text-[14px] font-semibold">Totaal {euros(lineTotal(data.lines))}</span>}
          </div>
        </div>
      </Card>

      <Card title="Foto's voor en na" description="Maak de foto met je telefoon; hij verschijnt hier vanzelf.">
        <div className="flex flex-wrap gap-3">
          {(["voor", "na"] as const).map((slot) => {
            const photo = d.photos.filter((p) => p.slot === slot).at(-1);
            return (
              <div key={slot} className="flex w-40 flex-col gap-2">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-[14px] bg-sand text-[12px] text-muted-foreground">
                  {photo ? <img src={photo.image} alt={`Foto ${slot}`} className="size-full object-cover" /> : `Geen foto (${slot})`}
                </div>
                <PillButton size="sm" variant="outline" onClick={() => void makeQr(slot)}>Maak foto met je telefoon</PillButton>
              </div>
            );
          })}
          <div className="flex flex-col justify-end gap-2">
            <PillButton size="sm" variant="outline" onClick={() => setCompare(true)} disabled={allPhotos.length < 2}>Vergelijk over tijd</PillButton>
            <PillButton size="sm" variant="outline" onClick={() => setDraw(true)}>Tekenen op foto</PillButton>
          </div>
        </div>
        {data.drawing && <div className="mt-3"><p className="mb-1 text-[12px] text-muted-foreground">Tekening met injectiepunten ({data.drawing.points.length} punten)</p><img src={data.drawing.image} alt="Tekening" className="h-40 rounded-[14px]" /></div>}
      </Card>

      {content.controle.length > 0 && (
        <Card title="Controlevragen" description="Uit het dossiersjabloon.">
          <div className="flex flex-col gap-2">
            {content.controle.map((code) => {
              const q = lib(code);
              const v = data.libraryAnswers[code] ?? "";
              return (
                <div key={code} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
                  <span className="flex-1">{q?.text_nl ?? code}</span>
                  {["ja", "nee"].map((o) => <button key={o} type="button" onClick={() => patch({ libraryAnswers: { ...data.libraryAnswers, [code]: o } })} className={cn("rounded-full px-4 py-1.5 text-[13px]", v === o ? "bg-primary text-primary-foreground" : "bg-background")}>{o === "ja" ? "Ja" : "Nee"}</button>)}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {lotFor !== null && data.lines[lotFor] && <LotModal line={data.lines[lotFor]} onSave={(lot) => { patch({ lines: data.lines.map((x, xi) => xi === lotFor ? { ...x, lot } : x) }); setLotFor(null); }} onClose={() => setLotFor(null)} />}
      {qr && (
        <Modal open onOpenChange={(o) => !o && setQr(null)} title="Maak foto met je telefoon" description="Scan de code; de link werkt 10 minuten en alleen voor dit dossier."
          footer={<PillButton variant="outline" onClick={() => setQr(null)}>Sluiten</PillButton>}>
          <div className="flex flex-col items-center gap-3">
            <img src={qr.qr} alt="QR-code voor de uploadlink" className="rounded-[14px] bg-sand p-3" />
            <p className="break-all text-center text-[12px] text-muted-foreground">{qr.url}</p>
            <p className="text-[12px] text-muted-foreground">De foto verschijnt hier zodra hij verstuurd is.</p>
          </div>
        </Modal>
      )}
      {compare && <CompareModal photos={allPhotos} onClose={() => setCompare(false)} onShared={refresh} />}
      {draw && <DrawModal base={d.photos.at(-1)?.image ?? null} onSave={(image, points) => { patch({ drawing: { image, points } }); setDraw(false); }} onClose={() => setDraw(false)} />}
    </div>
  );
}

function LotModal({ line, onSave, onClose }: { line: StepData["lines"][number]; onSave: (lot: NonNullable<StepData["lines"][number]["lot"]>) => void; onClose: () => void }) {
  const [number, setNumber] = useState(line.lot?.number ?? "");
  const [month, setMonth] = useState(line.lot?.expiryMonth ?? "");
  const [year, setYear] = useState(line.lot?.expiryYear ?? "");
  const [code, setCode] = useState(line.lot?.uniqueCode ?? "");
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Lotnummer · ${line.name}`} description="Verplicht voor deze behandeling."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!number.trim() || !month || !year} onClick={() => onSave({ number: number.trim(), expiryMonth: month, expiryYear: year, uniqueCode: code.trim() })}>Opslaan</PillButton></>}>
      <div className="flex flex-col gap-4">
        <TextField label="Lotnummer" value={number} onChange={(e) => setNumber(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Vervalmaand" value={month} onChange={setMonth} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: String(i + 1).padStart(2, "0") }))} />
          <Select label="Vervaljaar" value={year} onChange={setYear} options={[2026, 2027, 2028, 2029, 2030].map((y) => ({ value: String(y), label: String(y) }))} />
        </div>
        <TextField label="Unieke code (optioneel)" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
    </Modal>
  );
}

/** Compare any two photos across all earlier treatments; download or share with the patient. */
function CompareModal({ photos, onClose, onShared }: { photos: Array<{ id: string; slot: string; image: string; shared_with_patient: boolean; created_at: string }>; onClose: () => void; onShared: () => void }) {
  const [a, setA] = useState(photos[0]?.id ?? "");
  const [b, setB] = useState(photos.at(-1)?.id ?? "");
  const pa = photos.find((p) => p.id === a), pb = photos.find((p) => p.id === b);
  const share = async (id: string, v: boolean) => { await shareConsultPhoto({ data: { photoId: id, share: v } }); onShared(); };
  const opt = (p: (typeof photos)[number]) => ({ value: p.id, label: `${p.slot} · ${formatClinicalDate(p.created_at, true)}` });
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Vergelijk over tijd" footer={<PillButton variant="outline" onClick={onClose}>Sluiten</PillButton>}>
      <div className="grid grid-cols-2 gap-4">
        {([[pa, setA, a], [pb, setB, b]] as const).map(([p, set, v], i) => (
          <div key={i} className="flex flex-col gap-2">
            <Select label={i === 0 ? "Foto 1" : "Foto 2"} value={v} onChange={set} options={photos.map(opt)} />
            <div className="flex h-56 items-center justify-center overflow-hidden rounded-[14px] bg-sand">{p ? <img src={p.image} alt="" className="size-full object-cover" /> : <span className="text-[12px] text-muted-foreground">Kies een foto</span>}</div>
            {p && <div className="flex gap-3">
              <a href={p.image} download={`foto-${p.slot}-${p.created_at.slice(0, 10)}.png`} className="text-[13px] text-primary underline">Download</a>
              <TextLink onClick={() => void share(p.id, !p.shared_with_patient)}>{p.shared_with_patient ? "Niet meer delen met patiënt" : "Deel met patiënt"}</TextLink>
            </div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Drawing canvas on a template or photo: pen, text and eraser, with presets of injection points. */
function DrawModal({ base, onSave, onClose }: { base: string | null; onSave: (image: string, points: Array<{ x: number; y: number; units: number }>) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  const [points, setPoints] = useState<Array<{ x: number; y: number; units: number }>>([]);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.fillStyle = "#F7F2F0"; c.fillRect(0, 0, 560, 320);
    if (base) { const img = new Image(); img.onload = () => c.drawImage(img, 0, 0, 560, 320); img.src = base; }
  }, [base]);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [(e.clientX - r.left) * (560 / r.width), (e.clientY - r.top) * (320 / r.height)] as const; };
  const preset = () => {
    const c = ref.current!.getContext("2d")!;
    const pts = [[180, 110], [240, 100], [300, 100], [360, 110], [270, 150]].map(([x, y]) => ({ x: x!, y: y!, units: 4 }));
    c.fillStyle = "#317689";
    for (const p of pts) { c.beginPath(); c.arc(p.x, p.y, 6, 0, Math.PI * 2); c.fill(); }
    setPoints((x) => [...x, ...pts]);
  };
  const down = (e: React.PointerEvent) => {
    const c = ref.current!.getContext("2d")!;
    if (tool === "text") { const t = window.prompt("Tekst"); if (t) { c.fillStyle = "#39332E"; c.font = "14px sans-serif"; c.fillText(t, ...pos(e)); } return; }
    drawing.current = true;
    c.strokeStyle = tool === "eraser" ? "#F7F2F0" : "#317689"; c.lineWidth = tool === "eraser" ? 18 : 2.5; c.lineCap = "round";
    c.beginPath(); c.moveTo(...pos(e));
  };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const c = ref.current!.getContext("2d")!; c.lineTo(...pos(e)); c.stroke(); };
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Tekenen" description="Pen, tekst of gum; het voorkeurspatroon zet vaste injectiepunten met eenheden."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={() => onSave(ref.current!.toDataURL("image/png"), points)}>Bewaar tekening</PillButton></>}>
      <div className="mb-3 flex gap-2">
        {([["pen", "Pen"], ["text", "Tekst"], ["eraser", "Gum"]] as const).map(([t, l]) => <button key={t} type="button" onClick={() => setTool(t)} className={cn("rounded-full px-4 py-1.5 text-[13px]", tool === t ? "bg-primary text-primary-foreground" : "bg-sand")}>{l}</button>)}
        <button type="button" onClick={preset} className="rounded-full bg-sand px-4 py-1.5 text-[13px]">Voorkeurspatroon frons (5 × 4 eenheden)</button>
      </div>
      <canvas ref={ref} width={560} height={320} className="w-full touch-none rounded-[14px] ring-1 ring-mist" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
    </Modal>
  );
}

/** Stap 6: huisartsbrief, notitie en nazorg voor Mijn omgeving, herinnering en het sluiten van het dossier. */
function Closing({ d, data, patch, checklist }: { d: ConsultPageData; data: StepData; patch: (p: Partial<StepData>) => void; checklist: ReturnType<typeof closeChecklist> }) {
  const qc = useQueryClient();
  const [finish, setFinish] = useState(false);
  const cosmetic = !d.template?.content.steps.includes("plan_recept");
  const letter = gpLetterText(d.gpLetterTemplate, {
    patient: `${d.patient.first_name} ${d.patient.last_name}`,
    datum: formatClinicalDate(d.appointment?.starts_at ?? new Date().toISOString()),
    behandeling: d.appointment?.treatment?.name_nl ?? "—",
    diagnose: data.diagnoses.join(", ") || "—",
    medicatie: d.prescription?.medication ?? "—",
    arts: `${d.appointment?.practitioner?.first_name ?? ""} ${d.appointment?.practitioner?.last_name ?? ""}`.trim() || "—",
  });
  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { void qc.invalidateQueries(); },
    onError: (e) => toast.error(e.message),
  });
  const allDone = checklist.every((i) => i.done);
  return (
    <div className="flex flex-col gap-6">
      <Card title="Brief aan de huisarts" description="Gegenereerd uit het sjabloon met de gegevens van dit consult.">
        <div className="flex flex-col gap-4">
          <TextArea label="Brief" rows={8} value={data.closing.gpLetter || letter} onChange={(e) => patch({ closing: { ...data.closing, gpLetter: e.target.value } })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Versturen via" value={data.closing.gpChannel} onChange={(v) => patch({ closing: { ...data.closing, gpChannel: v } })} options={d.mailChannels} />
            <Select label="Huisarts" value={d.patient.gp_name ?? ""} onChange={() => undefined} options={d.gps.map((g) => ({ value: g.id, label: `${g.name}${g.city ? `, ${g.city}` : ""}` }))} disabled />
          </div>
          <Checkbox checked={data.closing.gpCopyToPortal} onChange={(v) => patch({ closing: { ...data.closing, gpCopyToPortal: v } })} label="Kopie naar Mijn omgeving" />
          <div><PillButton size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate(async () => { await sendGpLetter({ data: { noteId: d.note.id, channel: data.closing.gpChannel, recipient: d.patient.gp_name ?? "", body: data.closing.gpLetter || letter, stepData: data as unknown as Record<string, unknown> } }); toast.success(data.closing.gpChannel === "none" ? "Brief bewaard, niet verstuurd" : "Brief verstuurd (demo)"); })}>Verstuur brief</PillButton></div>
        </div>
      </Card>
      <Card title="Voor de patiënt" description="Komt in Mijn omgeving.">
        <div className="flex flex-col gap-4">
          <TextArea label="Notitie voor de patiënt" rows={3} value={data.closing.patientNote} onChange={(e) => patch({ closing: { ...data.closing, patientNote: e.target.value } })} />
          <TextArea label="Nazorg" rows={3} value={data.closing.aftercare} onChange={(e) => patch({ closing: { ...data.closing, aftercare: e.target.value } })} />
          <Select label="Behandelherinnering" value={String(data.closing.reminderDays)} onChange={(v) => patch({ closing: { ...data.closing, reminderDays: Number(v) } })} options={d.reminderOptions} />
        </div>
      </Card>
      <Card title="Dossier sluiten" description="Alles uit het sjabloon moet af zijn.">
        <div className="flex flex-col gap-2">
          {checklist.map((i) => (
            <div key={i.key} className="flex items-center gap-3 rounded-[14px] p-3.5 ring-1 ring-mist">
              <span className={cn("flex size-7 items-center justify-center rounded-full", i.done ? "bg-teal-light text-primary" : "bg-warning-bg text-warning")}><UiIcon name={i.done ? "vinkje" : "waarschuwing"} className="size-3.5" /></span>
              <span className="text-[14px]">{i.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {cosmetic ? (
            <PillButton disabled={mut.isPending} onClick={() => mut.mutate(async () => { if (d.appointment) await readyForPayment({ data: { appointmentId: d.appointment.id, note: data.closing.receptionNote } }); toast.success("Doorgegeven aan de receptie voor betaling"); })}>Klaar voor betaling</PillButton>
          ) : (
            <p className="rounded-[14px] bg-teal-light px-4 py-3 text-sm text-primary">Geen kassa nodig: het pakket staat klaar in Mijn omgeving.</p>
          )}
          {cosmetic && <TextField label="Notitie voor de receptie" value={data.closing.receptionNote} onChange={(e) => patch({ closing: { ...data.closing, receptionNote: e.target.value } })} />}
          <PillButton variant="outline" onClick={() => setFinish(true)} disabled={!allDone}>Dossier sluiten</PillButton>
          <TextLink onClick={() => window.dispatchEvent(new Event("tbc:finish-consult"))}>Later afsluiten</TextLink>
        </div>
      </Card>
      {finish && (
        <Modal open onOpenChange={(o) => !o && setFinish(false)} title="Dossier sluiten" description="Het verslag wordt vastgezet in het dossier."
          footer={<><PillButton variant="outline" onClick={() => setFinish(false)}>Annuleren</PillButton><PillButton onClick={() => { setFinish(false); window.dispatchEvent(new Event("tbc:finish-consult")); }}>Sluiten en afronden</PillButton></>}>
          <p className="text-sm">Het consult wordt afgerond via de bestaande afronding; de notities en stappen blijven bewaard.</p>
        </Modal>
      )}
    </div>
  );
}
