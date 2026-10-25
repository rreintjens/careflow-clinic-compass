/**
 * The online-agenda menu as one free tree: groups (treatment_categories) and treatment placements
 * (treatment_category_links, or treatment_menu_root for the top level) share one order per parent.
 */
export interface MenuData {
  groups: ReadonlyArray<{ id: string; parent_id: string | null; sort: number }>;
  links: ReadonlyArray<{ treatment_id: string; category_id: string; sort: number }>;
  roots: ReadonlyArray<{ treatment_id: string; sort: number }>;
}
export type MenuItem = { kind: "group"; id: string } | { kind: "treatment"; id: string };
export type Parent = string | null;

/** Children of a parent in the shared order; groups win a tie. */
export function children(m: MenuData, parent: Parent): MenuItem[] {
  const g = m.groups.filter((x) => (x.parent_id ?? null) === parent).map((x) => ({ item: { kind: "group", id: x.id } as MenuItem, sort: x.sort, w: 0 }));
  const t = (parent === null ? m.roots.map((r) => ({ id: r.treatment_id, sort: r.sort })) : m.links.filter((l) => l.category_id === parent).map((l) => ({ id: l.treatment_id, sort: l.sort })))
    .map((x) => ({ item: { kind: "treatment", id: x.id } as MenuItem, sort: x.sort, w: 1 }));
  return [...g, ...t].sort((a, b) => a.sort - b.sort || a.w - b.w).map((x) => x.item);
}

/** Group level: 1 for a top-level group. */
export function depth(m: MenuData, groupId: string): number {
  let d = 0;
  let cur: string | null = groupId;
  while (cur && d < 50) { d++; cur = m.groups.find((g) => g.id === cur)?.parent_id ?? null; }
  return d;
}

/** Levels of groups in a group's subtree, the group itself included. */
export function height(m: MenuData, groupId: string): number {
  const subs = m.groups.filter((g) => g.parent_id === groupId);
  return 1 + (subs.length ? Math.max(...subs.map((s) => height(m, s.id))) : 0);
}

export function isInside(m: MenuData, groupId: string, maybeAncestor: string): boolean {
  let cur: string | null = groupId;
  for (let i = 0; cur && i < 50; i++) { if (cur === maybeAncestor) return true; cur = m.groups.find((g) => g.id === cur)?.parent_id ?? null; }
  return false;
}

export function parentsOfTreatment(m: MenuData, treatmentId: string): Parent[] {
  return [...(m.roots.some((r) => r.treatment_id === treatmentId) ? [null] : []), ...m.links.filter((l) => l.treatment_id === treatmentId).map((l) => l.category_id)];
}

/** Why a move is refused, or null when allowed. */
export function moveError(m: MenuData, item: MenuItem, from: Parent, to: Parent, maxDepth: number): string | null {
  if (item.kind === "group") {
    if (to && isInside(m, to, item.id)) return "Kan niet: een groep kan niet in zichzelf";
    const parentDepth = to ? depth(m, to) : 0;
    if (parentDepth + height(m, item.id) > maxDepth) return `Kan niet: maximaal ${maxDepth === 3 ? "drie" : maxDepth} lagen groepen`;
    return null;
  }
  if (from !== to && parentsOfTreatment(m, item.id).includes(to)) return "Kan niet: deze behandeling staat hier al";
  return null;
}

/** A new group fits under this parent. */
export const canAddGroup = (m: MenuData, parent: Parent, maxDepth: number) => (parent ? depth(m, parent) : 0) < maxDepth;

/** Icon with fallback: own icon, else nearest parent group with one, else the default. */
export function resolveIcon(m: MenuData & { groupIcon: (id: string) => string | null | undefined }, own: string | null | undefined, parent: Parent, fallback: string): { icon: string; inherited: boolean } {
  if (own) return { icon: own, inherited: false };
  let cur: Parent = parent;
  for (let i = 0; cur && i < 50; i++) {
    const ic = m.groupIcon(cur);
    if (ic) return { icon: ic, inherited: true };
    cur = m.groups.find((g) => g.id === cur)?.parent_id ?? null;
  }
  return { icon: fallback, inherited: true };
}

/** What the patient sees under a parent: empty groups hidden; a group with one visible item shows that item instead. */
export function visibleChildren(m: MenuData, parent: Parent, visibleTreatment: (id: string) => boolean): MenuItem[] {
  const out: MenuItem[] = [];
  const seen = new Set<string>();
  for (const it of children(m, parent)) {
    const r = it.kind === "treatment" ? (visibleTreatment(it.id) ? it : null) : collapse(m, it.id, visibleTreatment, 0);
    if (r && !seen.has(`${r.kind}:${r.id}`)) { seen.add(`${r.kind}:${r.id}`); out.push(r); }
  }
  return out;
}

function collapse(m: MenuData, groupId: string, vis: (id: string) => boolean, guard: number): MenuItem | null {
  if (guard > 20) return null;
  const inner = visibleChildren(m, groupId, vis);
  if (inner.length === 0) return null;
  if (inner.length === 1) return inner[0] as MenuItem;
  return { kind: "group", id: groupId };
}

/** All groups under a group (transitively), the group included. */
export function descendants(m: Pick<MenuData, "groups">, groupId: string): string[] {
  const out = [groupId];
  for (let i = 0; i < out.length; i++) for (const g of m.groups) if (g.parent_id === out[i] && !out.includes(g.id)) out.push(g.id);
  return out;
}

/** Treatments anywhere under a parent. */
export function treatmentsIn(m: MenuData, parent: Parent): string[] {
  const groups = parent ? descendants(m, parent) : m.groups.map((g) => g.id);
  const ids = new Set(m.links.filter((l) => groups.includes(l.category_id)).map((l) => l.treatment_id));
  if (!parent) for (const r of m.roots) ids.add(r.treatment_id);
  return [...ids];
}

/** Path labels like "Lasertherapie › Huid"; top level is "Eerste laag". */
export function pathLabel(m: MenuData, parent: Parent, name: (id: string) => string): string {
  if (!parent) return "Eerste laag";
  const parts: string[] = [];
  let cur: Parent = parent;
  for (let i = 0; cur && i < 50; i++) { parts.unshift(name(cur)); cur = m.groups.find((g) => g.id === cur)?.parent_id ?? null; }
  return parts.join(" › ");
}

/** Contents moved one level up when a group is dissolved, at the group's position; duplicates dropped. */
export function dissolvePlan(m: MenuData, groupId: string) {
  const g = m.groups.find((x) => x.id === groupId);
  const up: Parent = g?.parent_id ?? null;
  const own = children(m, groupId);
  const already = new Set(m.links.filter((l) => l.category_id === up).map((l) => l.treatment_id));
  if (up === null) for (const r of m.roots) already.add(r.treatment_id);
  const moved = own.filter((it) => it.kind === "group" || !already.has(it.id));
  const dropped = own.filter((it) => it.kind === "treatment" && already.has(it.id)).map((it) => it.id);
  const siblings = children(m, up);
  const at = siblings.findIndex((x) => x.kind === "group" && x.id === groupId);
  const order = [...siblings.slice(0, at), ...moved, ...siblings.slice(at + 1)];
  return { parent: up, moved, dropped, order };
}
