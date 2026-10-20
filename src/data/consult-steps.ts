import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { readContent, mergeTemplates, type LibraryQuestion, type TemplateContent } from "@/domain/dossier-templates";
import { readStepData, type StepData } from "@/domain/consult-steps";
import type { QuestionnaireDef } from "@/domain/questionnaire/engine";

export interface ConsultPageData {
  note: { id: string; patient_id: string; appointment_id: string | null; subjective: string; objective: string; evaluation: string; plan: string; status: string; step_data: StepData; template_version_ids: string[] };
  appointment: { id: string; starts_at: string; ends_at: string; status: string; treatment_id: string; practitioner_id: string; location_id: string | null; treatment: { name_nl: string; vat_exemption_possible: boolean; price_cents: number | null; price_per: string | null; material_unit: string | null; lot_required: boolean } | null; practitioner: { first_name: string; last_name: string } | null } | null;
  patient: { id: string; first_name: string; last_name: string; patient_number: number | null; gp_name: string | null };
  template: { name: string; version: number; content: TemplateContent } | null;
  library: LibraryQuestion[];
  answerSet: { id: string; completed_at: string | null; created_at: string; answers: unknown; signals: unknown; definition: QuestionnaireDef | null } | null;
  icd10: Array<{ value: string; label: string }>;
  soepTemplates: Array<{ value: string; label: string; group: string }>;
  pharmacies: Array<{ id: string; name: string; city: string }>;
  gps: Array<{ id: string; name: string; city: string; send_channel: string }>;
  gpLetterTemplate: string;
  mailChannels: Array<{ value: string; label: string }>;
  reminderOptions: Array<{ value: string; label: string }>;
  prescription: { id: string; medication: string; r_text: string; s_text: string; pharmacy_id: string | null; signature: string | null; status: string; signed_at: string | null } | null;
  photos: Array<{ id: string; slot: string; image: string; shared_with_patient: boolean; created_at: string }>;
  treatments: Array<{ id: string; name_nl: string; price_cents: number | null; price_per: string | null; material_unit: string | null; lot_required: boolean }>;
  permissions: { sign: boolean; vat: boolean };
}

type Row = Record<string, unknown>;
const ok = async (p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<unknown> => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };
const rows = async (p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> => ((await ok(p)) ?? []) as Row[];
const row = async (p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row | null> => (await ok(p)) as Row | null;

/** Everything the consult page needs; the template comes from the treatment's categories (live versions, merged). */
export const consultPageQuery = (noteId: string) => queryOptions({
  queryKey: ["consult-page", noteId],
  queryFn: async (): Promise<ConsultPageData | null> => {
    const note = await row(supabase.from("consult_notes").select("id, patient_id, appointment_id, subjective, objective, evaluation, plan, status, step_data, template_version_ids").eq("id", noteId).single());
    if (!note) return null;
    const [appt, patient] = await Promise.all([
      note["appointment_id"] ? row(supabase.from("appointments").select("id, starts_at, ends_at, status, treatment_id, practitioner_id, location_id, treatment:treatments(name_nl, vat_exemption_possible, price_cents, price_per, material_unit, lot_required), practitioner:practitioners(first_name, last_name)").eq("id", note["appointment_id"] as string).single()) : Promise.resolve(null),
      row(supabase.from("patients").select("id, first_name, last_name, patient_number, gp_name").eq("id", note["patient_id"] as string).single()),
    ]);

    // Live templates of the treatment's categories, merged (per-treatment override wins).
    let template: ConsultPageData["template"] = null;
    const treatmentId = appt?.["treatment_id"] as string | undefined;
    if (treatmentId) {
      const t = await row(supabase.from("treatments").select("dossier_template_override, treatment_category_treatments(treatment_categories(id))").eq("id", treatmentId).single());
      const catIds = ((t?.["treatment_category_treatments"] as Array<{ treatment_categories: { id: string } | null }> | undefined) ?? []).map((r) => r.treatment_categories?.id).filter(Boolean) as string[];
      const override = t?.["dossier_template_override"] as string | null | undefined;
      const tpls = await rows(supabase.from("dossier_templates").select("id, name, category_id").in("category_id", catIds.length ? catIds : ["-"]));
      const chosen = override ? tpls.filter((x) => x["id"] === override) : tpls;
      const versions = chosen.length ? await rows(supabase.from("dossier_template_versions").select("template_id, version, content").in("template_id", chosen.map((x) => x["id"] as string)).eq("status", "live")) : [];
      if (versions.length) {
        const merged = mergeTemplates(versions.map((v) => readContent(v["content"])));
        template = { name: chosen.map((x) => x["name"] as string).join(" + "), version: Math.max(...versions.map((v) => v["version"] as number)), content: merged };
      }
    }

    const codes = template ? [...new Set([...template.content.anamnese, ...template.content.fiscaal, ...template.content.bespreekpunt, ...template.content.controle])] : [];
    const [library, icd10, soep, addresses, gpLetter, channels, reminders, prescription, photos, treatments, me] = await Promise.all([
      codes.length ? rows(supabase.from("library_questions").select("*").in("code", codes)) : Promise.resolve([] as Row[]),
      rows(supabase.from("option_lists").select("value, label_nl").eq("list_key", "icd10").order("sort")),
      rows(supabase.from("option_lists").select("value, label_nl").eq("list_key", "soep_template").order("sort")),
      rows(supabase.from("address_book").select("id, kind, name, city, send_channel").order("name")),
      row(supabase.from("option_lists").select("label_nl").eq("list_key", "gp_letter_template").eq("value", "standaard").maybeSingle()),
      rows(supabase.from("option_lists").select("value, label_nl").eq("list_key", "secure_mail_channel").order("sort")),
      rows(supabase.from("option_lists").select("value, label_nl").eq("list_key", "reminder_days").order("sort")),
      row(supabase.from("prescriptions").select("id, medication, r_text, s_text, pharmacy_id, signature, status, signed_at").eq("consult_note_id", noteId).neq("status", "ingetrokken").order("created_at", { ascending: false }).limit(1).maybeSingle()),
      rows(supabase.from("consult_photos").select("id, slot, image, shared_with_patient, created_at").eq("consult_note_id", noteId).order("created_at")),
      rows(supabase.from("treatments").select("id, name_nl, price_cents, price_per, material_unit, lot_required").eq("status", "active").order("name_nl")),
      supabase.auth.getUser(),
    ]);

    // Latest completed answer set of the template's questionnaire (frozen version).
    let answerSet: ConsultPageData["answerSet"] = null;
    if (template?.content.questionnaire.key) {
      const set = await row(supabase.from("answer_sets").select("id, completed_at, created_at, answers, signals, version_id").eq("patient_id", note["patient_id"] as string).eq("questionnaire_key", template.content.questionnaire.key).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle());
      if (set) {
        const def = set["version_id"] ? await row(supabase.from("questionnaire_versions").select("definition").eq("id", set["version_id"] as string).maybeSingle()) : null;
        answerSet = { id: set["id"] as string, completed_at: set["completed_at"] as string | null, created_at: set["created_at"] as string, answers: set["answers"], signals: set["signals"], definition: (def?.["definition"] as unknown as QuestionnaireDef) ?? null };
      }
    }

    let permissions = { sign: false, vat: false };
    if (me.data.user) {
      const [s, v] = await Promise.all([supabase.rpc("has_permission", { _perm: "prescription.sign" }), supabase.rpc("has_permission", { _perm: "vat.exemption" })]);
      permissions = { sign: !!s.data, vat: !!v.data };
    }

    return {
      note: { ...(note as unknown as ConsultPageData["note"]), step_data: readStepData(note["step_data"]) },
      appointment: appt as unknown as ConsultPageData["appointment"],
      patient: patient as unknown as ConsultPageData["patient"],
      template,
      library: library.map((r) => ({ ...r, options: (r["options"] ?? []) as LibraryQuestion["options"], condition: (r["condition"] ?? null) as LibraryQuestion["condition"] })) as unknown as LibraryQuestion[],
      answerSet,
      icd10: icd10.map((r) => ({ value: r["value"] as string, label: `${r["value"]} · ${r["label_nl"]}` })),
      soepTemplates: soep.map((r) => ({ value: r["label_nl"] as string, label: r["label_nl"] as string, group: r["value"] as string })),
      pharmacies: addresses.filter((a) => a["kind"] === "apotheek") as unknown as ConsultPageData["pharmacies"],
      gps: addresses.filter((a) => a["kind"] === "huisarts") as unknown as ConsultPageData["gps"],
      gpLetterTemplate: (gpLetter?.["label_nl"] as string) ?? "",
      mailChannels: channels.map((r) => ({ value: r["value"] as string, label: r["label_nl"] as string })),
      reminderOptions: reminders.map((r) => ({ value: r["value"] as string, label: r["label_nl"] as string })),
      prescription: prescription as unknown as ConsultPageData["prescription"],
      photos: photos as unknown as ConsultPageData["photos"],
      treatments: treatments as unknown as ConsultPageData["treatments"],
      permissions,
    };
  },
});

/** Photos across all of the patient's consults, for the Foto's tab and the compare view. */
export const patientPhotosQuery = (patientId: string) => queryOptions({
  queryKey: ["patient-photos", patientId],
  queryFn: async () => (await rows(supabase.from("consult_photos").select("id, consult_note_id, slot, image, shared_with_patient, created_at").eq("patient_id", patientId).order("created_at"))) as unknown as Array<{ id: string; consult_note_id: string; slot: string; image: string; shared_with_patient: boolean; created_at: string }>,
});
