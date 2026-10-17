import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { CONSULT_OPTIONS, LANDING_OPTIONS, SCOPE_LABELS, rolesQuery, saveRolePermissions, updateRole, usersQuery } from "@/data/roles";
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
        actions={<PillButton variant="outline" disabled>Nieuwe rol</PillButton>}
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
            ["users", `Gebruikers (${users.data?.length ?? data.userRoles.length})`],
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
            {(users.data ?? []).map((u) => {
              const rid = data.userRoles.find((x) => x.user_id === u.id)?.role_id;
              return (
                <li key={u.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="font-medium">{u.full_name}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                  <span>{data.roles.find((r) => r.id === rid)?.name}</span>
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

      {role && <RoleModal key={role.id} role={role} onClose={() => setEditing(null)} />}
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

function RoleModal({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [landing, setLanding] = useState(role.landing_page);
  const [consult, setConsult] = useState(role.consult_mode);
  const save = useMutation({
    mutationFn: () => updateRole(role.id, { landing_page: landing, consult_mode: consult }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rolesQuery.queryKey });
      await qc.invalidateQueries({ queryKey: staffContextQuery.queryKey });
      onClose();
    },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={role.name}
      footer={
        <>
          <PillButton variant="ghost" onClick={onClose}>Annuleren</PillButton>
          <PillButton onClick={() => save.mutate()} disabled={save.isPending}>Opslaan</PillButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Startpagina na inloggen" options={LANDING_OPTIONS} value={landing} onChange={setLanding} />
        <Select label="Consultmodus" options={CONSULT_OPTIONS} value={consult} onChange={setConsult} />
      </div>
    </Modal>
  );
}
