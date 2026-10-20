/**
 * Manage-appointment link (from the confirmation mail). The manage token is the only key;
 * functions return display data for that one appointment only.
 */
import { createServerFn } from "@tanstack/react-start";
import { safeQueue } from "./mailer.server";
import { z } from "zod";

import { canChangeOnline, manageable } from "@/domain/manage";
import { cancelPolicy } from "@/domain/mail";
import { admin, computeSlots, localParts, localToUtc, resolveTenant } from "./booking.server";

const base = z.object({ merk: z.string().max(60).optional(), token: z.string().uuid() });

async function load(merk: string | undefined, token: string) {
  const tenant = await resolveTenant(merk);
  if (!tenant) return null;
  const db = await admin();
  const appt = (await db.from("appointments").select("id, status, starts_at, ends_at, treatment_id, location_id, practitioner_id, meet_link, manage_token, cancel_reason")
    .eq("tenant_id", tenant.id).eq("manage_token", token).maybeSingle()).data;
  if (!appt) return null;
  const st = ((await db.from("settings").select("key, value").eq("tenant_id", tenant.id)).data ?? []) as Array<{ key: string; value: unknown }>;
  const v = (k: string) => st.find((r) => r.key === k)?.value;
  const defaultHours = Number(v("cancel_until_hours")) > 0 ? Number(v("cancel_until_hours")) : 24;
  // Verzetten/annuleren volgt de behandeling, dan de categorie, dan Algemeen.
  const [treat, links] = await Promise.all([
    db.from("treatments").select("cancel_until_hours, no_show_fee_eur").eq("id", appt.treatment_id).maybeSingle(),
    db.from("treatment_category_links").select("category_id").eq("treatment_id", appt.treatment_id),
  ]);
  const catIds = (links.data ?? []).map((x) => x.category_id);
  const cats = catIds.length ? ((await db.from("treatment_categories").select("id, parent_id, cancel_until_hours, no_show_fee_eur").in("id", catIds)).data ?? []) : [];
  const mainIds = [...new Set(cats.map((c) => c.parent_id ?? c.id))];
  const mains = mainIds.length ? ((await db.from("treatment_categories").select("id, parent_id, cancel_until_hours, no_show_fee_eur").in("id", mainIds)).data ?? []) : [];
  const category = mains.find((m) => m.cancel_until_hours != null) ?? mains[0] ?? null;
  const hours = cancelPolicy(treat.data, category, { cancelHours: defaultHours, noShowCents: 0 }).hours;
  const phone = typeof v("mail_phone") === "string" ? (v("mail_phone") as string) : null;
  return { tenant, db, appt, hours, phone };
}

export const getManagedAppointment = createServerFn({ method: "POST" })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const db0 = await admin();
    const ui = (await db0.from("option_lists").select("list_key, value, label_nl, label_en, sort").in("list_key", ["booking_ui", "cancel_reason"]).order("sort")).data ?? [];
    const x = await load(data.merk, data.token);
    if (!x) return { found: false as const, ui };
    const { db, appt, tenant } = x;
    const [t, l, p] = await Promise.all([
      db.from("treatments").select("name_nl, name_en, duration_min, post_questionnaire_key").eq("id", appt.treatment_id).single(),
      db.from("locations").select("name, kind, address").eq("id", appt.location_id).single(),
      db.from("practitioners").select("first_name, last_name").eq("id", appt.practitioner_id).single(),
    ]);
    return {
      found: true as const, ui, phone: x.phone, hours: x.hours, timeZone: tenant.time_zone,
      status: appt.status, startsAt: appt.starts_at, endsAt: appt.ends_at, meetLink: appt.meet_link, cancelReason: appt.cancel_reason,
      canChange: manageable(appt.status) && canChangeOnline(appt.starts_at, new Date(), x.hours),
      treatment: { nl: t.data?.name_nl ?? "", en: t.data?.name_en ?? null, minutes: t.data?.duration_min ?? 0, hasQuestionnaire: !!t.data?.post_questionnaire_key, id: appt.treatment_id },
      location: { name: l.data?.name ?? "", online: l.data?.kind === "online", address: l.data?.address ?? "", id: appt.location_id },
      practitioner: { name: [p.data?.first_name, p.data?.last_name].filter(Boolean).join(" "), firstName: p.data?.first_name ?? "", id: appt.practitioner_id },
    };
  });

/** First free moments with the same practitioner and location (excluding the current appointment). */
export const getRescheduleSlots = createServerFn({ method: "POST" })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const x = await load(data.merk, data.token);
    if (!x || !manageable(x.appt.status)) return [];
    const from = localParts(new Date(), x.tenant.time_zone).date;
    const r = await computeSlots(x.tenant, { treatmentId: x.appt.treatment_id, locationId: x.appt.location_id, practitionerIds: [x.appt.practitioner_id], from, days: 21,excludeAppointmentId:x.appt.id });
    return (r.perPractitioner[x.appt.practitioner_id] ?? []).slice(0, 4).map((s) => ({ date: s.date, start: s.start }));
  });

/** Moves the appointment; the meeting link and answers stay attached to the same row. */
export const rescheduleAppointment = createServerFn({ method: "POST" })
  .inputValidator(base.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.number().int().min(0).max(1439) }))
  .handler(async ({ data }) => {
    const x = await load(data.merk, data.token);
    if (!x || !manageable(x.appt.status) || !canChangeOnline(x.appt.starts_at, new Date(), x.hours)) return { ok: false as const };
    const r = await computeSlots(x.tenant, { treatmentId: x.appt.treatment_id, locationId: x.appt.location_id, practitionerIds: [x.appt.practitioner_id], from: data.date, days: 1,excludeAppointmentId:x.appt.id });
    if (!(r.perPractitioner[x.appt.practitioner_id] ?? []).some((s) => s.date === data.date && s.start === data.start)) return { ok: false as const };
    const startsAt = localToUtc(data.date, data.start, x.tenant.time_zone);
    const len = Date.parse(x.appt.ends_at) - Date.parse(x.appt.starts_at);
    const upd = await x.db.from("appointments").update({ starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + len).toISOString() }).eq("id", x.appt.id).eq("status", "booked").select("id");
    if (upd.data?.length) await safeQueue(x.db, x.appt.id, "rescheduled");
    return { ok: !!upd.data?.length };
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const x = await load(data.merk, data.token);
    if (!x || !manageable(x.appt.status) || !canChangeOnline(x.appt.starts_at, new Date(), x.hours)) return { ok: false as const };
    const upd = await x.db.from("appointments").update({ status: "cancelled" }).eq("id", x.appt.id).eq("status", "booked").select("id");
    if (upd.data?.length) await safeQueue(x.db, x.appt.id, "cancelled", { dedupe: `cancelled-${x.appt.id}` });
    return { ok: !!upd.data?.length };
  });

/** Optional reason, chosen on the cancelled screen; only values from the option list. */
export const setCancelReason = createServerFn({ method: "POST" })
  .inputValidator(base.extend({ reason: z.string().max(80) }))
  .handler(async ({ data }) => {
    const x = await load(data.merk, data.token);
    if (!x || x.appt.status !== "cancelled") return { ok: false as const };
    const ok = (await x.db.from("option_lists").select("value").eq("list_key", "cancel_reason").eq("value", data.reason).maybeSingle()).data;
    if (!ok) return { ok: false as const };
    await x.db.from("appointments").update({ cancel_reason: data.reason }).eq("id", x.appt.id);
    return { ok: true as const };
  });
