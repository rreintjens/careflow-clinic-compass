import type { PickerOption } from "@/domain/picker";
import { SearchablePicker } from "./SearchablePicker";

export interface SelectOption extends PickerOption {}
export interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  help?: string | null;
  disabled?: boolean;
  className?: string;
  inline?: boolean;
  preserveOrder?: boolean;
}

/** Single selection delegates to the shared searchable picker. */
export function Select({ onChange, ...props }: SelectProps) {
  return <SearchablePicker {...props} onChange={values => onChange(values[0] ?? "")} />;
}
