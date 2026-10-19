import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { Checkbox, TextField, Toggle } from "@/components/Field";
import { CONSULT_OPTIONS, LANDING_OPTIONS, SCOPE_LABELS, createRole, deleteRole, practitionerLinksQuery, rolesQuery, saveRolePermissions, updateRole, usersQuery } from "@/data/roles";
import { createStaffUser, resetStaffPassword, updateStaffUser } from "@/data/users.functions";
import { useServerFn } from "@tanstack/react-start";
import { staffContextQuery } from "@/data/staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/instellingen/gebruikers-en-rollen")({
  head: () => ({ meta: [{ title: "Gebruikers en rollen · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(rolesQuery),
  component: RolesPage,
});

const label = (opts: readonly { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

function RolesPage() {
  const { data } = useSuspenseQuery(rolesQuery);
  const { data: me } = useSuspenseQuery(staffContextQuery);
  const users = useQuery(usersQuery);
  const qc = useQueryClient();
  const canManage = Boolean(me?.permissions.includes("roles.manage"));
  const [tab, setTab] = useState<"users" | "roles">("roles");
  const [editing, setEditing] = useState<string | null>(null);
  const [userEdit, setUserEdit] = useState<string | null>(null);
  const practitioners = useQuery(practitionerLinksQuery);

  const initial = useMemo(() => new Set(data.rolePermissions.map((r) => `${r.role_id}|${r.permission_key}`)), [data.rolePermissions]);
  const [checked, setChecked] = useState<Set<string>>(initial);
  const matrixRoles = data.roles.filter((r) => r.key !== "therapeut");
  const counts = (roleId: string) => data.userRoles.filter((u) => u.role_id === roleId).length;

  const diff = useMemo(() => {
    const toPair = (k: string) => {
      const [role_id = "", permission_key = ""] = k.split("|");
      return { role_id, permission_key };
    };
    return {
      add: [...checked].filter((k) => !initial.has(k)).map(toPair),
      remove: [...initial].filter((k) => !checked.has(k)).map(toPair),
    };
  }, [checked, initial]);

  const save = useMutation({
    mutationFn: () => saveRolePermissions(diff.add, diff.remove),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rolesQuery.queryKey });
      toast.success("Wijzigingen opgeslagen");
    },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });

  const groups = [...new Set(data.permissions.map((p) => p.group_label))];
  const role = data.roles.find((r) => r.id === editing);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gebruikers en rollen"
        description="Vink per rol aan wat die rol mag. De superadmin heeft altijd alle rechten en er blijft altijd minstens één superadmin."
        actions={canManage && <div className="flex gap-2"><PillButton variant="outline" onClick={() => setEditing("new")}>Nieuwe rol</PillButton><PillButton onClick={() => setUserEdit("new")}>Nieuwe gebruiker</PillButton></div>}
      />
      <Card title="Startpagina en consultmodus per rol" description="Waar iemand landt na het inloggen, en wie het notitiepaneel en de tellers ziet.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted-foreground">
              <th className="px-2.5 py-2 font-normal">Rol</th>
              <th className="px-2.5 py-2 font-normal">Startpagina na inloggen</th>
              <th className="px-2.5 py-2 font-normal">Consultmodus</th>
              <th className="px-2.5 py-2 font-normal">Ziet in het dossier</th>
            </tr>
          </thead>
          <tbody>
            {data.roles.map((r) => (
              <tr
                key={r.id}
                onClick={canManage ? () => setEditing(r.id) : undefined}
                className={cn("border-b border-line", canManage && "cursor-pointer hover:bg-sand")}
              >
                <td className="px-2.5 py-3">{r.name}</td>
                <td className="px-2.5 py-3">{label(LANDING_OPTIONS, r.landing_page)}</td>
                <td className="px-2.5 py-3">{label(CONSULT_OPTIONS, r.consult_mode)}</td>
                <td className="px-2.5 py-3">{r.record_visibility}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Per rol in te stellen in de pop-up van de rol; dit is de standaard.</p>
      </Card>

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-line">
        {(
          [
            ["users", `Gebruikers (${data.userRoles.length})`],
            ["roles", "Rollen en rechten"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("whitespace-nowrap border-b-2 pb-2.5 text-sm", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {data.userRoles.map((m) => {
              const u = users.data?.find((x) => x.id === m.user_id);
              const pr = practitioners.data?.find((x) => x.user_id === m.user_id);
              const status = u?.blocked ? "Geblokkeerd" : m.active ? "Actief" : "Gedeactiveerd";
              return (
                <li key={m.user_id} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_110px_70px] items-center gap-4 py-3">
                  <span className="font-medium">{u?.full_name ?? "Onbekend"}</span>
                  <span className="truncate text-muted-foreground">{u?.email}</span>
                  <span>{data.roles.find((r) => r.id === m.role_id)?.name}</span>
                  <span className="text-muted-foreground">{pr ? `${pr.first_name} ${pr.last_name}` : "Geen behandelaar"}</span>
                  <span><span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs", status === "Actief" ? "bg-teal-light text-primary-hover" : "bg-warning-bg text-warning")}>{status}</span></span>
                  {canManage ? <button type="button" className="text-primary underline" onClick={() => setUserEdit(m.user_id)}>Wijzig</button> : <span />}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-2.5 py-3 text-left align-bottom text-xs font-normal text-muted-foreground">Recht</th>
                  {matrixRoles.map((r) => (
                    <th key={r.id} className="whitespace-nowrap px-2.5 py-3 text-center font-semibold">
                      {r.name}
                      <div className="text-xs font-normal text-muted-foreground">{counts(r.id)} gebruikers</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows
                    key={g}
                    group={g}
                    permissions={data.permissions.filter((p) => p.group_label === g)}
                    roles={matrixRoles}
                    checked={checked}
                    disabled={!canManage}
                    onToggle={(k) =>
                      setChecked((s) => {
                        const n = new Set(s);
                        if (n.has(k)) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4">
            <PillButton onClick={() => save.mutate()} disabled={!canManage || save.isPending || diff.add.length + diff.remove.length === 0}>
              Wijzigingen opslaan
            </PillButton>
            <span className="text-xs text-muted-foreground">Elke wijziging in rollen en rechten komt in het logboek.</span>
          </div>
        </>
      )}

      {(role || editing === "new") && (
        <RoleModal key={editing ?? ""} role={role ?? null} members={role ? counts(role.id) : 0} permissions={data.permissions} granted={new Set(data.rolePermissions.filter((x) => x.role_id === role?.id).map((x) => x.permission_key))}
          visibilities={[...new Set(data.roles.map((r) => r.record_visibility))]} nextSort={Math.max(0, ...data.roles.map((r) => r.sort ?? 0)) + 1} onClose={() => setEditing(null)} />
      )}
      {userEdit && (
        <UserModal key={userEdit} userId={userEdit === "new" ? null : userEdit} roles={data.roles} member={data.userRoles.find((m) => m.user_id === userEdit) ?? null}
          profile={users.data?.find((u) => u.id === userEdit) ?? null} practitioners={practitioners.data ?? []} onClose={() => setUserEdit(null)} />
      )}
    </div>
  );
}

type RoleRow = { id: string; key: string; name: string; patient_scope: string; landing_page: string; consult_mode: string };

function GroupRows({
  group,
  permissions,
  roles,
  checked,
  disabled,
  onToggle,
}: {
  group: string;
  permissions: Array<{ key: string; label: string; sublabel: string | null }>;
  roles: RoleRow[];
  checked: Set<string>;
  disabled: boolean;
  onToggle: (k: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="px-2.5 pb-2 pt-5 text-[13px] font-semibold text-primary">{group}</td>
      </tr>
      {permissions.map((p) => (
        <tr key={p.key} className="border-b border-line">
          <td className="px-2.5 py-3">
            {p.label}
            {p.sublabel && <div className="text-xs text-muted-foreground">{p.sublabel}</div>}
          </td>
          {roles.map((r) => {
            const su = r.key === "superadmin";
            const k = `${r.id}|${p.key}`;
            return (
              <td key={r.id} className="px-2.5 py-3 text-center">
                <input
                  type="checkbox"
                  aria-label={`${r.name}: ${group} ${p.label}`}
                  className="size-[18px] accent-primary disabled:opacity-50"
                  checked={su || checked.has(k)}
                  disabled={su || disabled}
                  onChange={() => onToggle(k)}
                />
              </td>
            );
          })}
        </tr>
      ))}
      {group === "Patiënten" && (
        <tr className="border-b border-line">
          <td className="px-2.5 py-3">Welke patiënten</td>
          {roles.map((r) => (
            <td key={r.id} className="px-2.5 py-3 text-center">
              <span className="rounded-full bg-teal-light px-2.5 py-1 text-xs text-primary-hover">{SCOPE_LABELS[r.patient_scope]}</span>
            </td>
          ))}
        </tr>
      )}
    </>
  );
}

type Perm = { key: string; label: string; group_label: string };
function RoleModal({ role, members, permissions, granted, visibilities, nextSort, onClose }: { role: (RoleRow & { record_visibility: string }) | null; members: number; permissions: Perm[]; granted: Set<string>; visibilities: string[]; nextSort: number; onClose: () => void }) {
  const qc = useQueryClient();
  const su = role?.key === "superadmin";
  const [name, setName] = useState(role?.name ?? "");
  const [landing, setLanding] = useState(role?.landing_page ?? "dashboard");
  const [consult, setConsult] = useState(role?.consult_mode ?? "no");
  const [vis, setVis] = useState(role?.record_visibility ?? visibilities[0] ?? "Alles");
  const [perms, setPerms] = useState<Set<string>>(new Set(granted));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = async () => {
    await qc.invalidateQueries({ queryKey: rolesQuery.queryKey });
    await qc.invalidateQueries({ queryKey: staffContextQuery.queryKey });
    onClose();
  };
  const save = useMutation({
    mutationFn: async () => {
      const id = role ? (await updateRole(role.id, { name: name.trim(), landing_page: landing, consult_mode: consult, record_visibility: vis }), role.id)
        : await createRole({ name: name.trim(), landing_page: landing, consult_mode: consult, record_visibility: vis, sort: nextSort });
      if (!su) await saveRolePermissions([...perms].filter((k) => !granted.has(k)).map((k) => ({ role_id: id, permission_key: k })), [...granted].filter((k) => !perms.has(k)).map((k) => ({ role_id: id, permission_key: k })));
    },
    onSuccess: async () => { toast.success(role ? "Rol opgeslagen" : "Rol aangemaakt"); await done(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteRole(role!.id),
    onSuccess: async () => { toast.success("Rol verwijderd"); await done(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  const groups = [...new Set(permissions.map((p) => p.group_label))];
  const canDelete = role && !su && members === 0;
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title={role ? role.name : "Nieuwe rol"} description={role ? `${members} gebruikers met deze rol` : "Naam, startpagina, consultmodus en wat de rol mag."}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {role && !su ? (canDelete
            ? (confirmDelete ? <button type="button" className="text-sm text-warning underline" onClick={() => del.mutate()}>Ja, rol verwijderen</button> : <button type="button" className="text-sm text-warning underline" onClick={() => setConfirmDelete(true)}>Rol verwijderen</button>)
            : <span className="text-xs text-muted-foreground">Verwijderen kan pas als niemand deze rol meer heeft.</span>) : <span />}
          <div className="flex gap-2">
            <PillButton variant="outline" onClick={onClose}>Annuleren</PillButton>
            <PillButton onClick={() => save.mutate()} disabled={save.isPending || name.trim().length < 2}>Opslaan</PillButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Naam" value={name} disabled={su} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Startpagina na inloggen" options={LANDING_OPTIONS} value={landing} onChange={setLanding} />
          <Select label="Consultmodus" options={CONSULT_OPTIONS} value={consult} onChange={setConsult} />
        </div>
        <Select label="Ziet in het dossier" options={visibilities.map((v) => ({ value: v, label: v }))} value={vis} onChange={setVis} />
        <div>
          <p className="mb-2 text-sm font-medium">Rechten</p>
          {su ? <p className="text-sm text-muted-foreground">De superadmin heeft altijd alle rechten.</p> : groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="mb-1 text-[13px] font-semibold text-primary">{g}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {permissions.filter((p) => p.group_label === g).map((p) => (
                  <Checkbox key={p.key} label={p.label} checked={perms.has(p.key)} onChange={(on) => setPerms((x) => { const n = new Set(x); if (on) n.add(p.key); else n.delete(p.key); return n; })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

type Member = { user_id: string; role_id: string; active: boolean };
function UserModal({ userId, roles, member, profile, practitioners, onClose }: { userId: string | null; roles: Array<{ id: string; name: string }>; member: Member | null; profile: { full_name: string; email: string; blocked: boolean } | null; practitioners: Array<{ id: string; first_name: string; last_name: string; user_id: string | null }>; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createStaffUser), update = useServerFn(updateStaffUser), reset = useServerFn(resetStaffPassword);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [roleId, setRoleId] = useState(member?.role_id ?? "");
  const linked = practitioners.find((p) => userId && p.user_id === userId)?.id ?? "";
  const [prac, setPrac] = useState(linked);
  const [active, setActive] = useState(member?.active ?? true);
  const [password, setPassword] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: rolesQuery.queryKey }), qc.invalidateQueries({ queryKey: usersQuery.queryKey }), qc.invalidateQueries({ queryKey: practitionerLinksQuery.queryKey })]);
  const run = useMutation({
    mutationFn: async (kind: "save" | "block" | "reset") => {
      if (kind === "reset") return reset({ data: { user_id: userId! } });
      if (kind === "block") return update({ data: { user_id: userId!, blocked: !profile?.blocked } });
      if (!userId) return create({ data: { full_name: name, email, role_id: roleId, practitioner_id: prac || null, active } });
      return update({ data: { user_id: userId, role_id: roleId, active, practitioner_id: prac || null } });
    },
    onSuccess: async (r, kind) => {
      if (!r.ok) { setMsg(String(r.error)); return; }
      await refresh();
      const pw = "password" in r ? (r.password as string | null) : null;
      if (pw) { setPassword(pw); return; }
      toast.success(kind === "reset" ? "Er is een e-mail gestuurd om het wachtwoord opnieuw in te stellen" : "invited" in r && r.invited ? "Uitnodiging verstuurd" : "Opgeslagen");
      onClose();
    },
    onError: () => setMsg("Dat is niet gelukt. Probeer het opnieuw."),
  });
  if (password) return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Wachtwoord, eenmalig zichtbaar" description={`Voor ${name || profile?.full_name} (${email || profile?.email})`} footer={<PillButton onClick={onClose}>Ik heb het genoteerd</PillButton>}>
      <p className="rounded-[14px] bg-sand px-4 py-3 font-mono text-lg tracking-wide" aria-label="Gegenereerd wachtwoord">{password}</p>
      <p className="mt-3 text-sm text-muted-foreground">Dit wachtwoord wordt nergens bewaard en is na sluiten niet meer te zien. Testmodus: het account is direct actief, zonder uitnodiging.</p>
    </Modal>
  );
  const freePrac = practitioners.filter((p) => !p.user_id || p.user_id === userId);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={userId ? profile?.full_name ?? "Gebruiker" : "Nieuwe gebruiker"} description={userId ? profile?.email ?? "" : "In testmodus krijgt het account direct een wachtwoord; anders sturen we een uitnodiging."}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {userId ? <div className="flex gap-4">
            <button type="button" className="text-sm text-warning underline" onClick={() => run.mutate("block")}>{profile?.blocked ? "Deblokkeren" : "Blokkeren"}</button>
            <button type="button" className="text-sm text-primary underline" onClick={() => run.mutate("reset")}>Wachtwoord resetten</button>
          </div> : <span />}
          <div className="flex gap-2">
            <PillButton variant="outline" onClick={onClose}>Annuleren</PillButton>
            <PillButton disabled={run.isPending || (!roleId || !userId && (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email)))} onClick={() => run.mutate("save")}>{userId ? "Opslaan" : "Gebruiker aanmaken"}</PillButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {!userId && <><TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} /><TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></>}
        <Select label="Rol in deze organisatie" options={[...(roleId ? [] : [{ value: "", label: "Kies een rol" }]), ...roles.map((r) => ({ value: r.id, label: r.name }))]} value={roleId} onChange={setRoleId} />
        <Select label="Gekoppelde behandelaar" options={[{ value: "", label: "Geen behandelaar" }, ...freePrac.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))]} value={prac} onChange={setPrac} />
        <Toggle label="Actief" checked={active} onChange={setActive} />
        {profile?.blocked && <p className="text-sm text-warning">Deze gebruiker is geblokkeerd en kan niet inloggen.</p>}
        {msg && <p role="alert" className="rounded-[12px] bg-warning-bg px-3 py-2 text-sm text-warning">{msg}</p>}
      </div>
    </Modal>
  );
}
