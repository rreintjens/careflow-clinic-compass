/** Dutch search words for the (English) icon library. */
export const DUTCH_SYNONYMS: Record<string, string[]> = {
  lippen: ["lips", "lip", "mouth", "kiss"], lip: ["lips", "mouth"], mond: ["mouth", "lips"], oog: ["eye"], ogen: ["eye"], huid: ["skin", "texture", "droplet"],
  haar: ["hair", "comb"], gezicht: ["face", "mood", "user"], weegschaal: ["scale"], meetlint: ["ruler", "measure"], spuit: ["syringe", "vaccine", "needle"],
  injectie: ["syringe", "vaccine"], pil: ["pill", "capsule", "medicine"], pillen: ["pill", "pills"], hart: ["heart"], zon: ["sun"], druppel: ["droplet", "drop"],
  laser: ["bolt", "laser", "flash"], slaap: ["moon", "bed", "zzz"], sport: ["run", "barbell", "bike", "swim"], neus: ["nose"], oor: ["ear"],
  tand: ["dental", "tooth"], tanden: ["dental"], hand: ["hand"], voet: ["shoe", "walk"], arts: ["stethoscope", "doctor", "nurse"], dokter: ["stethoscope", "doctor"],
  ster: ["star"], blad: ["leaf", "plant"], bloem: ["flower", "plant"], water: ["droplet", "water", "wave"], kalender: ["calendar"], klok: ["clock"],
  vrouw: ["woman", "female", "gender"], man: ["man", "male"], baby: ["baby"], apotheek: ["pill", "medicine", "first-aid"], vet: ["droplet", "scale"],
  afvallen: ["scale", "run", "ruler"], rimpel: ["wave", "mood"], rimpels: ["wave", "mood"], energie: ["bolt", "battery"], koud: ["snowflake", "temperature"],
  warm: ["flame", "temperature", "sun"], vuur: ["flame"], ijs: ["snowflake"], schoonheid: ["sparkles", "diamond", "star"], glans: ["sparkles", "diamond"],
  test: ["test-pipe", "dna", "flask"], dna: ["dna"], bloed: ["droplet", "heartbeat"], hersenen: ["brain"], buik: ["body", "scale"], lichaam: ["body", "accessible"],
  bewegen: ["run", "walk"], lopen: ["walk"], fiets: ["bike"], zwemmen: ["swim"], eten: ["apple", "salad", "tools-kitchen"], appel: ["apple"], camera: ["camera"],
  foto: ["photo", "camera"], video: ["video"], telefoon: ["phone"], mail: ["mail"], geld: ["coin", "cash", "currency-euro"], euro: ["currency-euro"], cadeau: ["gift"],
};

export function expandSearch(q: string): string[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return [t, ...(DUTCH_SYNONYMS[t] ?? [])];
}
