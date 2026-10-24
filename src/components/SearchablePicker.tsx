import * as Popover from "@radix-ui/react-popover";
import { useQuery, useQueryClient, QueryClient, QueryClientContext } from "@tanstack/react-query";
import { useContext, useId, useMemo, useRef, useState } from "react";
import { orgQuery, fullName, roleName, type Org } from "@/data/organisation";
import { filterPickerOptions, togglePickerGroup, type PickerOption } from "@/domain/picker";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { PillButton } from "./PillButton";
import { UiIcon } from "./UiIcon";

export interface SearchablePickerProps {
  label: string;
  options: readonly PickerOption[];
  value: string | string[];
  onChange: (value: string[]) => void;
  multiple?: boolean | undefined;
  help?: string | null | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  inline?: boolean | undefined;
  selectionPlacement?: "inside" | "below" | undefined;
  selectionOptions?: readonly PickerOption[] | undefined;
  selectionClassName?: string | undefined;
  preserveOrder?: boolean | undefined;
}

function enrich(options: readonly PickerOption[], org: Org | undefined, preserveOrder = false): PickerOption[] {
  if (!org) return [...options];
  const path = (id: string): string => {
    const category = org.categories.find(c => c.id === id);
    if (!category) return "";
    const parent = org.categories.find(c => c.id === category.parent_id);
    return [parent?.name_nl, category.name_nl].filter(Boolean).join(" › ");
  };
  return options.map(option => {
    const practitioner = org.practitioners.find(p => p.id === option.value);
    const treatment = org.treatments.find(t => t.id === option.value);
    const location = org.locations.find(l => l.id === option.value);
    const category = org.categories.find(c => c.id === option.value);
    if (practitioner) return { ...option, group: option.group ?? roleName(org, practitioner.role_id), photoPath: practitioner.photo_path, detail: option.detail ?? org.practitionerLocations.filter(l => l.practitioner_id === practitioner.id).map(l => org.locations.find(x => x.id === l.location_id)?.name).filter(Boolean).join(", "), keywords: [option.keywords, fullName(practitioner)].filter(Boolean).join(" ") };
    if (treatment) return { ...option, group: option.group ?? org.categoryLinks.filter(l => l.treatment_id === treatment.id).map(l => path(l.category_id)).filter(Boolean).join(" / "), detail: option.detail ?? `${treatment.duration_min} minuten` };
    if (location) return { ...option, detail: option.detail ?? [location.address, location.postal_city].filter(Boolean).join(", ") };
    if (category) return { ...option, group: option.group ?? path(category.parent_id ?? "") };
    return option;
  }).sort((a, b) => {
    if (preserveOrder) return 0;
    const online = (value: string) => org.locations.some(l => l.id === value && l.kind === "online");
    return Number(online(b.value)) - Number(online(a.value));
  });
}

function Highlight({ text, search }: { text: string; search: string }) {
  const needle = search.trim();
  if (!needle) return <>{text}</>;
  const start = text.toLocaleLowerCase("nl").indexOf(needle.toLocaleLowerCase("nl"));
  if (start < 0) return <>{text}</>;
  return <>{text.slice(0, start)}<mark className="bg-teal-light font-medium text-primary">{text.slice(start, start + needle.length)}</mark>{text.slice(start + needle.length)}</>;
}

const fallbackQueryClient=new QueryClient();
export function SearchablePicker(props:SearchablePickerProps) {
  const client=useContext(QueryClientContext);
  return <Picker {...props} queryClient={client??fallbackQueryClient}/>;
}
function Picker({ label, options, value, onChange, multiple, help, disabled, className, inline, selectionPlacement, selectionOptions, selectionClassName, preserveOrder, queryClient }: SearchablePickerProps & {queryClient:QueryClient}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient(queryClient);
  const hasIds = options.some(o => /^[0-9a-f]{8}-/i.test(o.value));
  const { data: fetchedOrg } = useQuery({ ...orgQuery, enabled: open && hasIds, staleTime: 60_000 },queryClient);
  const org = fetchedOrg ?? qc.getQueryData<Org>(orgQuery.queryKey);
  const enriched = useMemo(() => enrich(options, org, preserveOrder), [options, org, preserveOrder]);
  const selected = typeof value === "string" ? [value] : value;
  const chosen = (selectionOptions ? enrich(selectionOptions, org, preserveOrder) : enriched).filter(o => selected.includes(o.value));
  const filtered = filterPickerOptions(enriched, search);
  const eligible = filtered.filter(o => !o.disabled);
  const groups = [...new Set(filtered.map(o => o.group ?? ""))];
  const pick = (option: PickerOption) => {
    if (option.disabled) return;
    onChange(multiple ? selected.includes(option.value) ? selected.filter(v => v !== option.value) : [...selected, option.value] : [option.value]);
    if (!multiple) setOpen(false);
  };
  return <div className={cn("flex min-w-0 flex-col gap-2", className)}>
    <label htmlFor={id} className={cn("text-[13px] font-medium", inline && "sr-only")}>{label}</label>
    <Popover.Root open={open} onOpenChange={next => { setOpen(next); setSearch(""); setActive(null); }}>
      <Popover.Trigger asChild>
        <PillButton id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={label} disabled={disabled} variant="ghost" className={cn("h-auto min-h-12 w-full justify-between rounded-[14px] bg-sand px-4 py-2 text-left font-normal text-foreground hover:bg-sand", inline && "min-h-9 rounded-[10px] bg-background text-sm") }>
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {multiple && selectionPlacement === "below" ? <span>{label}</span> : multiple ? chosen.map(option => <span key={option.value} className="flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-sm"><span className="whitespace-normal">{option.label}</span><span role="button" tabIndex={0} aria-label={`${option.label} verwijderen`} onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(selected.filter(v => v !== option.value)); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(selected.filter(v => v !== option.value)); } }}><UiIcon name="kruis" className="h-3 w-3" /></span></span>) : <span className="truncate">{chosen[0]?.label ?? label}</span>}
          </span>
          <UiIcon name="zoeken" className="h-4 w-4 text-primary" />
        </PillButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[80] w-[min(480px,calc(100vw-32px))] min-w-[var(--radix-popover-trigger-width)] rounded-[14px] border border-mist bg-popover p-2 shadow-sm" onOpenAutoFocus={e => { e.preventDefault(); searchRef.current?.focus(); }}>
          <div className="flex items-center gap-2 border-b border-line p-2">
            <UiIcon name="zoeken" className="h-4 w-4 text-primary" />
            <input ref={searchRef} aria-label={`Zoek ${label.toLowerCase()}`} role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={active === null ? undefined : `${id}-${eligible.findIndex(o => o.value === active)}`} value={search} onChange={e => { setSearch(e.target.value); setActive(null); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none" onKeyDown={e => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const index = eligible.findIndex(o => o.value === active); const next = eligible[(index + (e.key === "ArrowDown" ? 1 : -1) + eligible.length) % eligible.length]; if (next) { setActive(next.value); document.getElementById(`${id}-${eligible.indexOf(next)}`)?.scrollIntoView({ block: "nearest" }); } }
              if (e.key === "Enter") { e.preventDefault(); const option = eligible.find(o => o.value === active) ?? eligible[0]; if (option) pick(option); }
            }} />
            {multiple && <PillButton variant="ghost" size="sm" onClick={() => onChange([])}>Wis selectie</PillButton>}
          </div>
          <div id={`${id}-list`} role="listbox" aria-label={label} aria-multiselectable={multiple ?? false} className="max-h-80 overflow-y-auto py-1">
            {groups.map(group => <div key={group}>
              {group && <div className="flex items-center justify-between gap-2 bg-sand px-3 py-2 text-xs font-medium"><Highlight text={group} search={search} />{multiple && <PillButton variant="ghost" size="sm" onClick={() => onChange(togglePickerGroup(selected, filtered.filter(o => (o.group ?? "") === group)))}>Alles in deze groep</PillButton>}</div>}
              {filtered.filter(o => (o.group ?? "") === group).map(option => <PillButton key={option.value} id={`${id}-${eligible.indexOf(option)}`} role="option" aria-selected={selected.includes(option.value)} aria-disabled={option.disabled ?? false} variant="ghost" disabled={option.disabled} title={option.reason} className={cn("h-auto min-h-11 w-full justify-start whitespace-normal rounded-[10px] px-3 py-2 text-left font-normal text-foreground", (active === option.value || selected.includes(option.value)) && "bg-teal-light")} onClick={() => pick(option)}>
                {multiple && <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary", selected.includes(option.value) && "bg-primary text-primary-foreground")}>{selected.includes(option.value) && <UiIcon name="vinkje" className="h-3 w-3" />}</span>}
                {option.photoPath && <Avatar path={option.photoPath} size={32} />}
                <span className="min-w-0 flex-1"><span className="block text-sm"><Highlight text={option.label} search={search} /></span>{(option.detail || option.reason) && <span className="block text-xs text-muted-foreground"><Highlight text={option.reason ?? option.detail ?? ""} search={search} /></span>}</span>
                {!multiple && selected.includes(option.value) && <UiIcon name="vinkje" className="h-4 w-4 text-primary" />}
              </PillButton>)}
            </div>)}
            {!filtered.length && <p className="p-4 text-sm text-muted-foreground">Geen resultaten</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    {selectionPlacement === "below" && chosen.length > 0 && <div className={cn("flex flex-wrap gap-2", selectionClassName)} aria-label={`Geselecteerd: ${label}`}>{chosen.map(option => <PillButton key={option.value} variant="ghost" size="sm" className="h-8 max-w-full bg-teal-light text-primary" aria-label={`${option.label} verwijderen`} onClick={() => onChange(selected.filter(v => v !== option.value))}><UiIcon name="kruis" className="size-3 shrink-0" />{option.photoPath && <Avatar path={option.photoPath} size={20} />}<span className="truncate">{option.label}</span></PillButton>)}</div>}
    {help && <span className="text-xs leading-[1.45] text-muted-foreground">{help}</span>}
  </div>;
}