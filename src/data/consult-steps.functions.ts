import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { mockPharmacyProvider, mockSecureMailProvider } from "@/domain/consult-providers";
import { nextPharmacyStatus } from "@/domain/consult-steps";

type Sb = Parameters<Parameters<ReturnType<typeof createServerFn>["middleware"]>[0]>[0] extends never ? never : import("@/integrations/supabase/auth-middleware").SupabaseAuthContext["supabase"];

const medical = async (sb: Sb, perm = "patients.medical") => {
  if (!(await sb.rpc("is_aal2")).data || !(await sb.rpc("has_permission", { _perm: perm })).data) throw new Error("Geen toegang");
};

/** Autosave of the step data; the whole jsonb goes at once, like the SOEP fields. */
export const saveStepData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid(), stepData: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase);
    const r = await context.supabase.from("consult_notes").update({ step_data: data.stepData }).eq("id", data.noteId).in("status", ["draft", "parked"]);
    if (r.error) throw new Error("Opslaan is niet gelukt");
    return { ok: true };
  });

/** Sign the prescription: doctors only (prescription.sign). */
export const signPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid(), patientId: z.string().uuid(), medication: z.string().min(1), rText: z.string(), sText: z.string(), pharmacyId: z.string().uuid().nullable(), signature: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase, "prescription.sign");
    const existing = await context.supabase.from("prescriptions").select("id").eq("consult_note_id", data.noteId).neq("status", "ingetrokken").maybeSingle();
    const row = { patient_id: data.patientId, medication: data.medication, r_text: data.rText, s_text: data.sText, pharmacy_id: data.pharmacyId, signature: data.signature, signed_by: context.userId, signed_at: new Date().toISOString(), status: "concept" };
    const r = existing.data
      ? await context.supabase.from("prescriptions").update(row).eq("id", existing.data.id)
      : await context.supabase.from("prescriptions").insert({ ...row, consult_note_id: data.noteId });
    if (r.error) throw new Error("Ondertekenen is niet gelukt");
    return { ok: true };
  });

/** Send to the pharmacy route (mock provider) or advance the mock status on poll. */
export const sendPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ prescriptionId: z.string().uuid(), action: z.enum(["send", "poll", "withdraw"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase);
    const cur = await context.supabase.from("prescriptions").select("id, status, signature").eq("id", data.prescriptionId).single();
    if (cur.error || !cur.data) throw new Error("Recept niet gevonden");
    let status: string | null = null;
    if (data.action === "send") {
      if (!cur.data.signature) throw new Error("Eerst ondertekenen");
      status = (await mockPharmacyProvider().send(data.prescriptionId)).status;
    } else if (data.action === "poll") {
      status = nextPharmacyStatus(cur.data.status);
    } else {
      status = "ingetrokken";
    }
    if (!status) return { status: cur.data.status };
    const r = await context.supabase.from("prescriptions").update({ status, ...(data.action === "send" ? { sent_at: new Date().toISOString() } : {}) }).eq("id", data.prescriptionId);
    if (r.error) throw new Error("Bijwerken is niet gelukt");
    return { status };
  });

/** Record the btw decision: doctors only (vat.exemption), stored with practitioner and time. */
export const recordVatDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid(), exempt: z.boolean(), answers: z.record(z.string(), z.string()), stepData: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase, "vat.exemption");
    const name = await context.supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const stepData = { ...data.stepData, vat: { exempt: data.exempt, answers: data.answers, by: name.data?.full_name ?? "arts", at: new Date().toISOString() } };
    const r = await context.supabase.from("consult_notes").update({ step_data: stepData }).eq("id", data.noteId);
    if (r.error) throw new Error("Vastleggen is niet gelukt");
    return { ok: true };
  });

/** "Maak foto met je telefoon": a 10-minute upload link tied to this open dossier. */
export const createPhotoToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid(), slot: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase);
    const token = crypto.randomUUID().replaceAll("-", "");
    const r = await context.supabase.from("photo_upload_tokens").insert({ consult_note_id: data.noteId, slot: data.slot, token, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (r.error) throw new Error("Link maken is niet gelukt");
    return { token };
  });

/** Public upload via the token; no login, token verified server-side, one use per photo. */
export const uploadConsultPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10), image: z.string().max(4_000_000) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t = await supabaseAdmin.from("photo_upload_tokens").select("id, tenant_id, consult_note_id, slot, expires_at, used_at").eq("token", data.token).maybeSingle();
    if (t.error || !t.data) throw new Error("Deze link klopt niet");
    if (t.data.used_at || new Date(t.data.expires_at).getTime() < Date.now()) throw new Error("Deze link is verlopen");
    const note = await supabaseAdmin.from("consult_notes").select("patient_id").eq("id", t.data.consult_note_id).single();
    if (note.error || !note.data) throw new Error("Dossier niet gevonden");
    const ins = await supabaseAdmin.from("consult_photos").insert({ tenant_id: t.data.tenant_id, consult_note_id: t.data.consult_note_id, patient_id: note.data.patient_id, slot: t.data.slot, image: data.image });
    if (ins.error) throw new Error("Uploaden is niet gelukt");
    await supabaseAdmin.from("photo_upload_tokens").update({ used_at: new Date().toISOString() }).eq("id", t.data.id);
    return { ok: true };
  });

/** Share or unshare a photo with the patient (Mijn omgeving). */
export const shareConsultPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ photoId: z.string().uuid(), share: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase);
    const r = await context.supabase.from("consult_photos").update({ shared_with_patient: data.share }).eq("id", data.photoId);
    if (r.error) throw new Error("Delen is niet gelukt");
    return { ok: true };
  });

/** Send the GP letter via the secure-mail mock; stores the reference in the step data. */
export const sendGpLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid(), channel: z.string(), recipient: z.string(), body: z.string(), stepData: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase);
    if (data.channel !== "none") await mockSecureMailProvider().send({ channel: data.channel, recipient: data.recipient, subject: "Brief vanuit het consult", body: data.body });
    const r = await context.supabase.from("consult_notes").update({ step_data: data.stepData }).eq("id", data.noteId);
    if (r.error) throw new Error("Versturen is niet gelukt");
    return { ok: true };
  });

/** Cosmetic: hand the appointment to reception ("Klaar voor betaling") with the doctor's note. */
export const readyForPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ appointmentId: z.string().uuid(), note: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase, "agenda.appointments");
    const r = await context.supabase.from("appointments").update({ status: "klaar_voor_betaling", reception_note: data.note }).eq("id", data.appointmentId);
    if (r.error) throw new Error("Doorgeven is niet gelukt");
    return { ok: true };
  });

/** Manual labels on the patient; "online_boeken_uit" also sets the booking block. */
export const savePatientLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ patientId: z.string().uuid(), labels: z.array(z.string()) }).parse(input))
  .handler(async ({ data, context }) => {
    await medical(context.supabase, "labels.manage");
    const r = await context.supabase.from("patients").update({ labels: data.labels, online_booking_blocked: data.labels.includes("online_boeken_uit") }).eq("id", data.patientId);
    if (r.error) throw new Error("Opslaan is niet gelukt");
    return { ok: true };
  });

/** Dossier row actions: duplicate, archive, or delete (superadmin only, reason required). */
export const dossierRowAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid(), action: z.enum(["duplicate", "archive", "delete"]), reason: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.action === "delete") {
      await medical(context.supabase, "dossier.delete");
      if (!data.reason?.trim()) throw new Error("Geef een reden op");
      const r = await context.supabase.from("consult_notes").delete().eq("id", data.noteId);
      if (r.error) throw new Error("Verwijderen is niet gelukt");
      return { ok: true };
    }
    await medical(context.supabase);
    const cur = await context.supabase.from("consult_notes").select("*").eq("id", data.noteId).single();
    if (cur.error || !cur.data) throw new Error("Notitie niet gevonden");
    if (data.action === "archive") {
      const r = await context.supabase.from("consult_notes").update({ visibility: "archived" }).eq("id", data.noteId);
      if (r.error) throw new Error("Archiveren is niet gelukt");
      return { ok: true };
    }
    const { id: _id, created_at: _c, updated_at: _u, finished_at: _f, ...rest } = cur.data;
    const r = await context.supabase.from("consult_notes").insert({ ...rest, status: "final", reason: `Kopie voor herhaalbehandeling` });
    if (r.error) throw new Error("Dupliceren is niet gelukt");
    return { ok: true };
  });
