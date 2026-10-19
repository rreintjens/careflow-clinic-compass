export interface PickerOption {
  value: string;
  label: string;
  group?: string | undefined;
  detail?: string | undefined;
  keywords?: string | undefined;
  photoPath?: string | null | undefined;
  disabled?: boolean | undefined;
  reason?: string | undefined;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl");
export function filterPickerOptions(options: readonly PickerOption[], search: string) {
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  return options.filter(option => words.every(word => normalize([option.label, option.group, option.detail, option.keywords].filter(Boolean).join(" ")).includes(word)));
}
export function togglePickerGroup(selected: readonly string[], options: readonly PickerOption[]) {
  const available = options.filter(option => !option.disabled).map(option => option.value);
  const all = available.every(value => selected.includes(value));
  return all ? selected.filter(value => !available.includes(value)) : [...new Set([...selected, ...available])];
}