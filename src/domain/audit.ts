/** Logbook lines in plain Dutch: who did what, with a link to the page or record. No ids or table names. */
export type AuditRow = {
  action: string;
  category: string;
  record_type: string | null;
  record_id: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
};
export type AuditLine = { actor: string | null; text: string; sub?: string | undefined; link?: string | undefined };

const PAGES: Array<[RegExp, string]> = [
  [/^\/dashboard/, "het dashboard"],
  [/^\/agenda\/mijn-dag/, "Mijn dag"],
  [/^\/agenda/, "de agenda"],
  [/^\/patienten\/?$/, "het patiëntenoverzicht"],
  [/^\/organisatie/, "de organisatie-instellingen"],
  [/^\/boekingsflow\/vragenlijsten/, "de vragenlijsten"],
  [/^\/boekingsflow\/boekingslinks/, "de boekingslinks"],
  [/^\/boekingsflow\/e-mails/, "de e-mails en sjablonen"],
  [/^\/boekingsflow/, "de boekingsflow"],
  [/^\/dossier\/vragenbibliotheek/, "de vragenbibliotheek"],
  [/^\/dossier/, "de dossiersjablonen"],
  [/^\/instellingen\/logboek/, "het logboek"],
  [/^\/instellingen\/gebruikers/, "gebruikers en rollen"],
  [/^\/instellingen/, "de instellingen"],
];
const TABS: Record<string, string> = { overzicht: "het dossier", tijdlijn: "de tijdlijn", medisch: "de medische gegevens", behandeling: "het behandelplan", documenten: "de documenten" };

/** Dutch noun for a changed table, never the table name itself. */
const NOUNS: Record<string, string> = {
  appointments: "een afspraak", patients: "een patiënt", consult_notes: "een consultverslag", measurements: "een meting",
  patient_contacts: "een contactmoment of notitie", patient_requests: "een aanvraag",
  treatment_plans: "een behandelplan", patient_documents: "een document", roles: "een rol", role_permissions: "de rechten van een rol",
  tenant_memberships: "een gebruiker", profiles: "een gebruiker", settings: "een instelling", holidays: "een feestdag",
  treatments: "een behandeling", practitioners: "een behandelaar", locations: "een locatie", rooms: "een ruimte", equipment: "een apparaat",
  questionnaires: "een vragenlijst", questionnaire_versions: "een vragenlijstversie", mail_templates: "een e-mailsjabloon", booking_links: "een boekingslink",
  schedule_blocks: "een rooster", schedule_exceptions: "een roosteruitzondering", anamnesis: "een anamnese", option_lists: "een keuzelijst",
  library_questions: "een bibliotheekvraag", dossier_templates: "een dossiersjabloon", dossier_template_versions: "een versie van een dossiersjabloon",
};
const VERBS: Record<string, string> = { insert: "heeft toegevoegd:", update: "heeft gewijzigd:", delete: "heeft verwijderd:" };

const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export function describeAudit(r: AuditRow): AuditLine {
  const d = r.details ?? {};
  const pn = s(d["patient_number"]);
  if (r.action === "viewed") {
    const route = s(d["route"]);
    const tab = s(d["tab"]);
    if (pn) return { actor: r.user_id, text: `heeft ${TABS[tab] ?? "het dossier"} van patiënt ${pn} bekeken.`, link: `/patienten/${pn}${tab && tab !== "overzicht" ? `/${tab}` : ""}` };
    const page = PAGES.find(([re]) => re.test(route))?.[1] ?? "een pagina";
    return { actor: r.user_id, text: `heeft ${page} bekeken.`, link: route };
  }
  if (r.action === "login") return { actor: r.user_id, text: "is ingelogd." };
  if (r.action === "logout") return { actor: r.user_id, text: "is uitgelogd." };
  if (r.action === "mfa_verified") return { actor: r.user_id, text: "is ingelogd met tweestapsverificatie." };
  if (r.action === "login_failed") return { actor: null, text: "Inloggen is mislukt." };
  if (r.action === "demo_login") return { actor: r.user_id, text: "is ingelogd met de demoknop." };
  if (r.action === "tenant_switched_in") return { actor: r.user_id, text: "is naar deze organisatie gewisseld." };
  if (r.action === "tenant_switched_out") return { actor: r.user_id, text: `is naar een andere organisatie gewisseld (${s(d["to"])}).` };
  const userActs: Record<string, string> = {
    user_created: `heeft gebruiker ${s(d["name"]) || "een nieuwe gebruiker"} ${d["invited"] ? "uitgenodigd" : "aangemaakt"}.`,
    user_changed: "heeft een gebruiker gewijzigd.", user_blocked: "heeft een gebruiker geblokkeerd.", user_unblocked: "heeft een gebruiker gedeblokkeerd.",
    user_activated: "heeft een gebruiker geactiveerd.", user_deactivated: "heeft een gebruiker gedeactiveerd.", password_reset: "heeft het wachtwoord van een gebruiker gereset.",
  };
  if (userActs[r.action]) return { actor: r.user_id, text: userActs[r.action] as string, link: "/instellingen/gebruikers-en-rollen" };
  if (r.action === "role_changed") return { actor: r.user_id, text: "heeft een rol of de rechten gewijzigd.", link: "/instellingen/gebruikers-en-rollen" };
  if (r.action === "settings_changed") return { actor: r.user_id, text: "heeft een instelling gewijzigd.", link: "/instellingen/algemeen" };
  const pid = r.record_type === "patients" ? r.record_id : s((d["after"] as Record<string, unknown> | undefined)?.["patient_id"] ?? (d["before"] as Record<string, unknown> | undefined)?.["patient_id"]);
  const pnum = pn || s((d["after"] as Record<string, unknown> | undefined)?.["patient_number"]);
  if (r.action === "patient_created") return { actor: r.user_id, text: pnum ? `Patiënt ${pnum} is aangemaakt.` : "Er is een patiënt aangemaakt.", link: pid ? `/patienten/${pnum || pid}` : undefined };
  if (r.action === "patient_updated") return { actor: r.user_id, text: `heeft de gegevens van patiënt ${pnum || ""} gewijzigd.`.replace("  ", " "), link: pid ? `/patienten/${pnum || pid}` : undefined };
  const m = r.action.match(/^(.+)_(insert|update|delete)$/);
  if (m) {
    const noun = NOUNS[m[1] as string] ?? "een gegeven";
    return { actor: r.user_id, text: `${VERBS[m[2] as string]} ${noun}.`, link: pid ? `/patienten/${pid}` : undefined };
  }
  return { actor: r.user_id, text: "heeft een actie uitgevoerd." };
}

/** CSV with Dutch headers; quotes every field. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
