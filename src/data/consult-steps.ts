import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { readContent, mergeTemplates, type LibraryQuestion, type TemplateContent } from "@/domain/dossier-templates";
import { readStepData, type StepData } from "@/domain/consult-steps";
import type { QuestionnaireDef } from "@/domain/questionnaire/engine";

export interface ConsultPageData {
  note: { id: string; patient_id: string; appointment_id: string | null; subjective: string; objective: string; evaluation: string; plan: string; status: string; step_data: StepData; template_version_ids: string[] };
  appointment: { id: string; starts_at: string; ends_at: string; status: string; treatment_id: string; practitioner_id: string; location_id: string | null; treatment: { name_nl: string; vat_exemption_possible: boolean; price_cents: number | null; price_per: string | null; material_unit: string | null; lot_required: boolean } | null; practitioner: { first_name: string; last_name: string } | null };
  patient: { id: string; first_name: string; last_name: string; patient_number: number | null; gp_name: string | null };
  template: { name: string; version: number; content: TemplateContent } | null;
  library: LibraryQuestion[];
  answerSet: { id: string; completed_at: string | null; created_at: string; answers: unknown; signals: unknown; definition: QuestionnaireDef | null } | null;
  icd10: Array<{ value: string; label: string }>;
  soepTemplates: Array<{ value: string; label: string }>;
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

const ok = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data as T; };

/** Everything the consult page needs; the template comes from the treatment's categories (live versions, merged). */
export const consultPageQuery = (noteId: string) => queryOptions({
  queryKey: ["consult-page", noteId],
  queryFn: async (): Promise<ConsultPageData | null> => {
    const note = await ok(supabase.from("consult_notes").select("id, patient_id, appointment_id, subjective, objective, evaluation, plan, status, step_data, template_version_ids").eq("id", noteId).single());
    const [appt, patient] = await Promise.all([
      note.appointment_id ? ok(supabase.from("appointments").select("id, starts_at, ends_at, status, treatment_id, practitioner_id, location_id, treatment:treatments(name_nl, vat_exemption_possible, price_cents, price_per, material_unit, lot_required), practitioner:practitioners(first_name, last_name)").eq("id", note.appointment_id).single()) : null,
      ok(supabase.from("patients").select("id, first_name, last_name, patient_number, gp_name").eq("id", note.patient_id).single()),
    ]);

    // Live templates of the treatment's categories, merged (per-treatment override wins).
    let template: ConsultPageData["template"] = null;
    if (appt?.treatment_id) {
      const t = await ok(supabase.from("treatments").select("dossier_template_override, treatment_category_treatments(treatment_categories(id, name_nl, parent_id))").eq("id", appt.treatment_id).single());
      const catIds = ((t as unknown as { treatment_category_treatments: Array<{ treatment_categories: { id: string } | null }> }).treatment_category_treatments ?? []).map((r) => r.treatment_categories?.id).filter(Boolean) as string[];
      const override = (t as unknown as { dossier_template_override: string | null }).dossier_template_override;
      const tpls = await ok(supabase.from("dossier_templates").select("id, name, category_id").in("category_id", catIds.length ? catIds : ["-"]));
      const chosen = override ? tpls.filter((x) => x.id === override) : tpls;
      const versions = chosen.length ? await ok(supabase.from("dossier_template_versions").select("template_id, version, content").in("template_id", chosen.map((x) => x.id)).eq("status", "live")) : [];
      if (versions.length) {
        const merged = mergeTemplates(versions.map((v) => readContent(v.content)));
        template = { name: chosen.map((x) => x.name).join(" + "), version: Math.max(...versions.map((v) => v.version)), content: merged };
      }
    }

    const codes = template ? [...new Set([...template.content.anamnese, ...template.content.fiscaal, ...template.content.bespreekpunt, ...template.content.controle])] : [];
    const [library, icd10, soep, addresses, gpLetter, channels, reminders, prescription, photos, treatments, me] = await Promise.all([
      codes.length ? ok(supabase.from("library_questions").select("*").in("code", codes)) : Promise.resolve([]),
      ok(supabase.from("option_lists").select("value, label_nl").eq("list_key", "icd10").order("sort")),
      ok(supabase.from("option_lists").select("value, label_nl").eq("list_key", "soep_template").order("sort")),
      ok(supabase.from("address_book").select("id, kind, name, city, send_channel").order("name")),
      ok(supabase.from("option_lists").select("label_nl").eq("list_key", "gp_letter_template").eq("value", "standaard").maybeSingle()),
      ok(supabase.from("option_lists").select("value, label_nl").eq("list_key", "secure_mail_channel").order("sort")),
      ok(supabase.from("option_lists").select("value, label_nl").eq("list_key", "reminder_days").order("sort")),
      ok(supabase.from("prescriptions").select("id, medication, r_text, s_text, pharmacy_id, signature, status, signed_at").eq("consult_note_id", noteId).neq("status", "ingetrokken").order("created_at", { ascending: false }).limit(1).maybeSingle()),
      ok(supabase.from("consult_photos").select("id, slot, image, shared_with_patient, created_at").eq("consult_note_id", noteId).order("created_at")),
      ok(supabase.from("treatments").select("id, name_nl, price_cents, price_per, material_unit, lot_required").eq("status", "active").order("name_nl")),
      supabase.auth.getUser(),
    ]);

    // Latest completed answer set of the template's questionnaire (frozen version).
    let answerSet: ConsultPageData["answerSet"] = null;
    if (template?.content.questionnaire.key) {
      const set = await ok(supabase.from("answer_sets").select("id, completed_at, created_at, answers, signals, version_id").eq("patient_id", note.patient_id).eq("questionnaire_key", template.content.questionnaire.key).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle());
      if (set) {
        const def = set.version_id ? await ok(supabase.from("questionnaire_versions").select("definition").eq("id", set.version_id).maybeSingle()) : null;
        answerSet = { ...set, definition: (def?.definition as unknown as QuestionnaireDef) ?? null };
      }
    }

    let permissions = { sign: false, vat: false };
    if (me.data.user) {
      const [s, v] = await Promise.all([supabase.rpc("has_permission", { _perm: "prescription.sign" }), supabase.rpc("has_permission", { _perm: "vat.exemption" })]);
      permissions = { sign: !!s.data, vat: !!v.data };
    }

    return {
      note: { ...note, step_data: readStepData(note.step_data) },
      appointment: appt as ConsultPageData["appointment"],
      patient: patient as ConsultPageData["patient"],
      template,
      library: (library as Array<Record<string, unknown>>).map((r) => ({ ...r, options: (r.options ?? []) as LibraryQuestion["options"], condition: r.condition as LibraryQuestion["condition"] })) as unknown as LibraryQuestion[],
      answerSet,
      icd10: icd10.map((r) => ({ value: r.value, label: `${r.value} · ${r.label_nl}` })),
      soepTemplates: soep.map((r) => ({ value: r.label_nl, label: r.label_nl, group: r.value })),
      pharmacies: addresses.filter((a) => a.kind === "apotheek"),
      gps: addresses.filter((a) => a.kind === "huisarts"),
      gpLetterTemplate: gpLetter?.label_nl ?? "",
      mailChannels: channels.map((r) => ({ value: r.value, label: r.label_nl })),
      reminderOptions: reminders.map((r) => ({ value: r.value, label: r.label_nl })),
      prescription,
      photos,
      treatments,
      permissions,
    };
  },
});

/** Photos across all of the patient's consults, for the Foto's tab and the compare view. */
export const patientPhotosQuery = (patientId: string) => queryOptions({
  queryKey: ["patient-photos", patientId],
  queryFn: async () => ok(supabase.from("consult_photos").select("id, consult_note_id, slot, image, shared_with_patient, created_at").eq("patient_id", patientId).order("created_at")),
});
