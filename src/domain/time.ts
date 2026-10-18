/** Pure local-time helpers: a brand has its own time zone, so every day part and slot is computed there. */

/** Local calendar date and minute-of-day of an instant in a time zone. */
export function zonedParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, minute: Number(p["hour"]) * 60 + Number(p["minute"]) };
}

/** UTC instant for a local date + minute of day in a time zone (DST-safe by iterating). */
export function instantForLocal(date: string, minute: number, tz: string): Date {
  const target = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const seen = Date.parse(`${p.date}T00:00:00Z`) + p.minute * 60_000;
    guess += target - seen;
  }
  return new Date(guess);
}

export const addLocalDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
