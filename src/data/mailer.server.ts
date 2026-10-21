/**
 * Demo mail delivery: every mail moment renders with the shared renderer and template resolution and lands in
 * the outbox. Only addresses on the tenant's allowlist are meant for real delivery; everything else is "demo only".
 */
import styles from "@/styles.css?raw";
import { allowlisted, blocksOf, cancelPolicy, cancelPolicyValues, interpolate, resolveMail, translated, type MailTemplate } from "@/domain/mail";
import { renderMailDocument, type MailTheme } from "@/domain/mail-document";
import { admin } from "./booking.server";
import {notificationEnabled} from "@/domain/appointment-notifications";
import {appointmentPreparation} from "./appointment-preparation.server";

type Db = Awaited<ReturnType<typeof admin>>;
export type MailMoment = "confirmation" | "rescheduled" | "cancelled" | "appointment_reminder" | "questionnaire_reminder" | "details_reminder" | "no_show" | "follow_up";

/** The global mail tokens, read from the same stylesheet the admin preview uses. */
export function theme(): MailTheme {
  const root = styles.slice(styles.indexOf(":root"));
  const v = (name: string) => root.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? "#39332E";
  return { background: v("background"), surface: v("mail-surface"), heading: v("mail-heading"), text: v("mail-text"), muted: v("muted-foreground"), panel: v("mail-panel"), button: v("mail-button"), onPanel: v("primary-foreground"), link: v("mail-link") };
}

const APP_URL = "https://careflow-clinic-compass.lovable.app";

/** Renders and stores one mail for an appointment. Returns the outbox status, or null when no template applies. */
export async function queueAppointmentMail(db: Db, appointmentId: string, moment: MailMoment, opts: { dedupe?: string } = {}) {
  const { data: a } = await db.from("appointments")
    .select("id, tenant_id, patient_id, treatment_id, practitioner_id, location_id, starts_at, ends_at, meet_link, manage_token, new_patient, notify, notification_plan,status")
    .eq("id", appointmentId).maybeSingle();
  if (!a?.patient_id) return null;
  if(moment==="questionnaire_reminder"||moment==="details_reminder"){
    if(!["booked","tentatief"].includes(a.status))return null;
    const preparation=await appointmentPreparation(a.tenant_id,a.patient_id,a.treatment_id,a.starts_at,a.id);
    if(moment==="questionnaire_reminder"?!preparation.questionnaireMissing:!preparation.detailsMissing)return null;
  }
  if(notificationEnabled(a.notification_plan,moment,"sms",a.notify)) {
    await db.from("sms_outbox").upsert({tenant_id:a.tenant_id,appointment_id:a.id,moment,dedupe_key:`sms-${opts.dedupe??`${a.id}-${moment}`}`},{onConflict:"dedupe_key",ignoreDuplicates:true});
  }
  if(!notificationEnabled(a.notification_plan,moment,"email",a.notify)) return null;
  const [tenant, patient, treatment, prac, loc, templates, links, settings, sets] = await Promise.all([
    db.from("tenants").select("id, slug, time_zone, default_language, booking_domains").eq("id", a.tenant_id).single(),
    db.from("patients").select("id, first_name, email").eq("id", a.patient_id).single(),
    db.from("treatments").select("name_nl, name_en, description_nl, description_en, preparation_nl, preparation_en, duration_min, post_questionnaire_key, cancel_until_hours, no_show_fee_eur, questionnaire_minutes").eq("id", a.treatment_id).single(),
    db.from("practitioners").select("first_name, last_name, photo_path").eq("id", a.practitioner_id).maybeSingle(),
    db.from("locations").select("name, kind, address, postal_city, maps_url, phone").eq("id", a.location_id).maybeSingle(),
    db.from("mail_templates").select("*").eq("tenant_id", a.tenant_id).neq("status", "archived"),
    db.from("treatment_category_links").select("category_id").eq("treatment_id", a.treatment_id),
    db.from("settings").select("key, value").eq("tenant_id", a.tenant_id),
    db.from("answer_sets").select("id").eq("appointment_id", a.id).eq("status", "completed"),
  ]);
  const t = tenant.data, p = patient.data, tr = treatment.data;
  if (!t || !p || !tr) return null;
  const st = (settings.data ?? []) as Array<{ key: string; value: unknown }>;
  const sv = (k: string) => st.find((r) => r.key === k)?.value;
  const catIds = (links.data ?? []).map((x) => x.category_id);
  const cats = catIds.length ? ((await db.from("treatment_categories").select("id, parent_id, cancel_until_hours, no_show_fee_eur, mail_image_path").in("id", catIds)).data ?? []) : [];
  const allCatIds = [...new Set([...catIds, ...cats.map((c) => c.parent_id).filter((x): x is string => !!x)])];
  const template = resolveMail((templates.data ?? []) as MailTemplate[], moment, a.treatment_id, allCatIds);
  if (!template) return null;

  const lang = t.default_language === "en" ? "en" : "nl";
  const start = new Date(a.starts_at);
  const day = start.toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: t.time_zone });
  const online = loc.data?.kind === "online";
  const base = t.booking_domains?.[0] ? `https://${t.booking_domains[0]}` : APP_URL;
  const policy = cancelPolicy(tr, cats.find((c) => c.cancel_until_hours != null) ?? null, { cancelHours: Number(sv("cancel_until_hours")) || 24, noShowCents: Number(sv("no_show_amount_cents")) || 0 });
  const noShow = ((await db.from("option_lists").select("label_nl").eq("list_key", "mail_ui").eq("value", "no_show_zin").maybeSingle()).data?.label_nl) ?? "";
  const values: Record<string, string> = {
    voornaam: p.first_name, dag: day, tijd: start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: t.time_zone }),
    behandeling: translated(tr.name_nl, tr.name_en, lang), duur: String(tr.duration_min), duur_eenheid: lang === "en" ? "minutes" : "minuten", vragenlijst_minuten: String(tr.questionnaire_minutes ?? 8),
    behandeling_omschrijving: translated(tr.description_nl, tr.description_en, lang), voorbereiding: translated(tr.preparation_nl, tr.preparation_en, lang),
    behandelaar: prac.data ? `${prac.data.first_name} ${prac.data.last_name}` : "", behandelaar_voornaam: prac.data?.first_name ?? "",
    locatie: online ? "Online" : loc.data?.name ?? "", locatie_naam: loc.data?.name ?? "", adres: [loc.data?.address, loc.data?.postal_city].filter(Boolean).join("\n"),
    maps_link: loc.data?.maps_url ?? "", telefoon: loc.data?.phone ?? (typeof sv("mail_phone") === "string" ? (sv("mail_phone") as string) : ""),
    e_mail: typeof sv("sender_address") === "string" ? (sv("sender_address") as string) : "", meet_link: a.meet_link ?? "",
    link_wijzigen: `${base}/afspraak/${a.manage_token}`, link_vragenlijst: `${base}/vragenlijst/${a.manage_token}`,link_gegevens:`${base}/mijn?returnTo=${encodeURIComponent('/mijn/profiel')}`,
    link_boeken: `${base}/boeken?t=${encodeURIComponent(a.treatment_id)}${a.practitioner_id ? `&p=${encodeURIComponent(a.practitioner_id)}` : ''}`,
    ...cancelPolicyValues(policy, noShow),
  };
  const situation = { online, existingPatient: !a.new_patient, questionnaire: !!tr.post_questionnaire_key, preparation: !!values["voorbereiding"] };
  const blocks = blocksOf(template);
  const sign = async (bucket: string, path: string | null | undefined) => (path ? (await db.storage.from(bucket).createSignedUrl(path, 7 * 24 * 3600)).data?.signedUrl ?? null : null);
  const imagePaths = [...new Set(blocks.map((b) => b.image_path).filter((x): x is string => !!x))];
  const images = Object.fromEntries((await Promise.all(imagePaths.map(async (path) => [path, await sign(`mail-images-${t.slug}`, path)] as const))).filter(([, u]) => !!u)) as Record<string, string>;
  const categoryImage = await sign(`mail-images-${t.slug}`, cats.find((c) => c.mail_image_path)?.mail_image_path);
  const practitionerPhoto = await sign(`practitioner-photos-${t.slug}`, prac.data?.photo_path);
  const html = renderMailDocument({ blocks, language: lang, values, situation, images, practitionerPhoto, categoryImage, theme: theme() });
  const subject = interpolate(translated(template.subject_nl, template.subject_en, lang), values);
  const status = allowlisted(sv("mail_allowlist"), p.email) ? "waiting_domain" : "demo_only";
  const r = await db.from("mail_outbox").insert({
    tenant_id: t.id, recipient: p.email, subject, html, moment, appointment_id: a.id, patient_id: p.id, template_id: template.id, status,
    error: status === "waiting_domain" ? "Er is nog geen afzenderdomein ingesteld; de mail wordt verstuurd zodra dat er is." : null,
    dedupe_key: opts.dedupe ?? null,
  });
  if (r.error) return null; // duplicate reminder (dedupe) or write failure: never block the booking itself
  return status;
}

/** Never let mail problems break the action that triggered them. */
export async function safeQueue(db: Db, appointmentId: string, moment: MailMoment, opts?: { dedupe?: string }) {
  try { return await queueAppointmentMail(db, appointmentId, moment, opts); } catch (e) { console.error("[mail] queue failed", moment, e); return null; }
}
